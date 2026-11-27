package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.dto.response.InsightReportResponse;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.insight.FinancialSnapshot;
import com.github.yildizmy.service.insight.GeneratedNarrative;
import com.github.yildizmy.service.insight.InsightNarrativeGenerator;
import com.github.yildizmy.service.insight.InsightRateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InsightsService {
    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final InsightNarrativeGenerator narrativeGenerator;
    private final InsightRateLimiter rateLimiter;
    private final Clock clock;
    private final TransactionOperations readOnly;

    @Autowired
    public InsightsService(
            TransactionRepository transactionRepository,
            WalletRepository walletRepository,
            InsightNarrativeGenerator narrativeGenerator,
            InsightRateLimiter rateLimiter,
            PlatformTransactionManager transactionManager
    ) {
        this(transactionRepository, walletRepository, narrativeGenerator, rateLimiter, Clock.systemUTC(),
                readOnly(transactionManager));
    }

    private static TransactionOperations readOnly(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setReadOnly(true);
        return template;
    }

    InsightsService(
            TransactionRepository transactionRepository,
            WalletRepository walletRepository,
            InsightNarrativeGenerator narrativeGenerator,
            InsightRateLimiter rateLimiter,
            Clock clock,
            TransactionOperations readOnly
    ) {
        this.transactionRepository = transactionRepository;
        this.walletRepository = walletRepository;
        this.narrativeGenerator = narrativeGenerator;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.readOnly = readOnly;
    }

    /**
     * Not transactional as a whole: the snapshot is read in a short read-only transaction and the AI call (up to
     * 20 s) happens after it, so a slow provider never holds a database connection.
     */
    public InsightReportResponse generate(Long userId, int months, String language) {
        FinancialSnapshot snapshot = readOnly.execute(status -> createSnapshot(userId, months));
        // Read apart from the snapshot on purpose: the snapshot may go to the AI provider, the institution must not.
        var bankData = readOnly.execute(status ->
                FutureService.bankData(walletRepository.findByUserId(userId), clock.instant()));
        GeneratedNarrative narrative = localNarrative(snapshot, language);
        String provider = "LOCAL";
        Map<String, String> research = researchContext("en".equals(language));

        if (narrativeGenerator.isEnabled()) {
            rateLimiter.check(userId);
        }
        if (narrativeGenerator.isEnabled() && rateLimiter.tryGlobal()) {
            try {
                Optional<GeneratedNarrative> generated = narrativeGenerator.generate(snapshot, language, research);
                if (generated.isPresent() && isUsable(generated.get())) {
                    narrative = generated.get();
                    provider = "GEMINI";
                }
            } catch (RuntimeException exception) {
                log.warn("AI narrative unavailable; local financial analysis was returned");
            }
        }

        return toResponse(snapshot, narrative, provider, language, bankData);
    }

    /**
     * Open Finance imports each side of a move between the user's own accounts separately: a Withdrawal in one
     * wallet and a Deposit in another, same value, same day. Those pairs are neither income nor expense.
     * Only imported entries whose Open Finance type is a move (Pix, TED, DOC, TEF, same-bank transfer) can pair, and
     * the two sides must have the same type (imports saved before V31 have none and fit any). A pair is hidden only
     * with evidence: the same description on both sides, in equal numbers; or, among what is left, one single
     * candidate on each side. Anything ambiguous stays visible.
     * ponytail: the import keeps no counterparty, so one Pix in and one unrelated Pix out of the same value and day,
     * with nothing else to compete, still pair. Upgrade: store the counterparty document the Accounts API sends
     * (partieCnpjCpf, encrypted) and require it to be the person's.
     */
    static Set<Transaction> ownAccountPairs(List<Transaction> transactions) {
        Map<String, List<Transaction>> deposits = new LinkedHashMap<>();
        Map<String, List<Transaction>> withdrawals = new LinkedHashMap<>();
        for (Transaction transaction : transactions) {
            if (!isImportedMove(transaction)) continue;
            String direction = transaction.getType().getName();
            if ("Deposit".equals(direction)) {
                deposits.computeIfAbsent(pairKey(transaction), key -> new ArrayList<>()).add(transaction);
            } else if ("Withdrawal".equals(direction)) {
                withdrawals.computeIfAbsent(pairKey(transaction), key -> new ArrayList<>()).add(transaction);
            }
        }
        // Identity, not equals: entities compare by id and unsaved ones would all look the same.
        Set<Transaction> paired = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        withdrawals.forEach((key, out) -> {
            List<Transaction> in = deposits.getOrDefault(key, List.of());
            // 1. Same description: interchangeable moves, hidden only when every one of them has its other side.
            out.stream().collect(Collectors.groupingBy(InsightsService::label)).forEach((label, sent) -> {
                List<Transaction> received = in.stream().filter(deposit -> label(deposit).equals(label)).toList();
                if (!label.isEmpty() && sent.size() == received.size()
                        && sent.stream().allMatch(one -> received.stream().allMatch(other -> canPair(one, other)))) {
                    paired.addAll(sent);
                    paired.addAll(received);
                }
            });
            // 2. What is left pairs only when neither side has another possible partner.
            List<Transaction> sent = out.stream().filter(one -> !paired.contains(one)).toList();
            List<Transaction> received = in.stream().filter(one -> !paired.contains(one)).toList();
            for (Transaction withdrawal : sent) {
                List<Transaction> candidates = received.stream().filter(deposit -> canPair(withdrawal, deposit)).toList();
                if (candidates.size() == 1
                        && sent.stream().filter(other -> canPair(other, candidates.get(0))).count() == 1) {
                    paired.add(withdrawal);
                    paired.add(candidates.get(0));
                }
            }
        });
        return paired;
    }

    private static boolean canPair(Transaction withdrawal, Transaction deposit) {
        return !deposit.getToWallet().getId().equals(withdrawal.getFromWallet().getId())
                && (withdrawal.getPaymentType() == null || deposit.getPaymentType() == null
                || withdrawal.getPaymentType().equals(deposit.getPaymentType()));
    }

    private static String label(Transaction transaction) {
        return com.github.yildizmy.service.future.RecurrenceDetector.counterpartyKey(transaction.getDescription());
    }

    private static final Set<String> MOVE_TYPES = Set.of("PIX", "TED", "DOC", "TEF", "TRANSFERENCIA_MESMA_INSTITUICAO");

    private static boolean isImportedMove(Transaction transaction) {
        return transaction.getSource() == com.github.yildizmy.domain.enums.TransactionSource.OPEN_FINANCE
                && (transaction.getPaymentType() == null || MOVE_TYPES.contains(transaction.getPaymentType()));
    }

    private static String pairKey(Transaction transaction) {
        LocalDate day = LocalDate.ofInstant(transaction.getCreatedAt(), FutureService.ZONE);
        // A scheduled (pending) side never pairs with a settled one.
        return day + ":" + transaction.getStatus() + ":" + money(transaction.getAmount()).toPlainString();
    }

    private FinancialSnapshot createSnapshot(Long userId, int months) {
        // Months close in Brasília time, the same calendar the Futuro screen uses.
        YearMonth currentMonth = YearMonth.now(clock.withZone(FutureService.ZONE));
        Instant start = currentMonth.minusMonths(months - 1L).atDay(1).atStartOfDay(FutureService.ZONE).toInstant();
        Set<Long> walletIds = walletRepository.findByUserId(userId).stream()
                .map(wallet -> wallet.getId())
                .collect(Collectors.toSet());

        Map<YearMonth, MutableFlow> monthly = new LinkedHashMap<>();
        for (int offset = months - 1; offset >= 0; offset--) {
            monthly.put(currentMonth.minusMonths(offset), new MutableFlow());
        }

        BigDecimal inflow = BigDecimal.ZERO;
        BigDecimal outflow = BigDecimal.ZERO;
        BigDecimal internalTransfers = BigDecimal.ZERO;
        long count = 0;

        List<Transaction> relevant = transactionRepository.findAllByUserIdSince(userId, start).stream()
                .filter(transaction -> transaction.getStatus() == Status.SUCCESS && !transaction.getCreatedAt().isBefore(start))
                .filter(transaction -> !"Initial balance".equals(transaction.getType().getName()))
                .toList();
        Set<Transaction> ownAccountPairs = ownAccountPairs(relevant);

        for (Transaction transaction : relevant) {
            String type = transaction.getType().getName();

            boolean fromOwned = walletIds.contains(transaction.getFromWallet().getId());
            boolean toOwned = walletIds.contains(transaction.getToWallet().getId());
            BigDecimal amount = money(transaction.getAmount());
            YearMonth month = YearMonth.from(transaction.getCreatedAt().atZone(FutureService.ZONE));
            MutableFlow flow = monthly.get(month);
            if (flow == null) continue;

            count++;
            if (ownAccountPairs.contains(transaction)) {
                // Half of an imported move between two of the user's own accounts: count the pair once, as internal.
                if ("Deposit".equals(type)) internalTransfers = internalTransfers.add(amount);
            } else if ("Deposit".equals(type)) {
                inflow = inflow.add(amount);
                flow.inflow = flow.inflow.add(amount);
            } else if ("Withdrawal".equals(type)) {
                outflow = outflow.add(amount);
                flow.outflow = flow.outflow.add(amount);
            } else if (fromOwned && toOwned) {
                internalTransfers = internalTransfers.add(amount);
            } else if (fromOwned) {
                outflow = outflow.add(amount);
                flow.outflow = flow.outflow.add(amount);
            } else if (toOwned) {
                inflow = inflow.add(amount);
                flow.inflow = flow.inflow.add(amount);
            }
        }

        List<FinancialSnapshot.MonthlyAggregate> flows = monthly.entrySet().stream()
                .map(entry -> new FinancialSnapshot.MonthlyAggregate(
                        entry.getKey().toString(), money(entry.getValue().inflow), money(entry.getValue().outflow)))
                .toList();
        return new FinancialSnapshot(months, money(inflow), money(outflow), money(internalTransfers),
                money(inflow.subtract(outflow)), count, flows);
    }

    private GeneratedNarrative localNarrative(FinancialSnapshot snapshot, String language) {
        boolean english = "en".equals(language);
        List<GeneratedNarrative.NarrativeItem> observations = new ArrayList<>();
        List<GeneratedNarrative.NarrativeItem> actions = new ArrayList<>();

        if (snapshot.transactionCount() == 0) {
            observations.add(item(
                    english ? "No activity in this period" : "Sem movimentações no período",
                    english ? "There is not enough cash-flow history for a useful comparison yet."
                            : "Ainda não há histórico de fluxo de caixa suficiente para uma comparação útil.",
                    "neutral", "BCB_EDUCACAO"));
            actions.add(item(
                    english ? "Build a consistent history" : "Crie um histórico consistente",
                    english ? "Record your movements regularly and generate this report again after a full month."
                            : "Registre suas movimentações regularmente e gere o relatório novamente após um mês completo.",
                    "neutral", "ME_POUPE"));
        } else {
            boolean positive = snapshot.netFlow().signum() >= 0;
            observations.add(item(
                    english ? "Cash-flow balance" : "Balanço do fluxo de caixa",
                    positive
                            ? (english ? "Recorded inflows covered outflows during the selected period."
                            : "As entradas registradas cobriram as saídas no período selecionado.")
                            : (english ? "Recorded outflows exceeded inflows during the selected period."
                            : "As saídas registradas superaram as entradas no período selecionado."),
                    positive ? "positive" : "attention", "BCB_EDUCACAO"));

            if (snapshot.internalTransfers().signum() > 0) {
                observations.add(item(
                        english ? "Internal transfers separated" : "Transferências internas separadas",
                        english ? "Transfers between your own wallets were excluded from income and spending totals."
                                : "Transferências entre suas próprias carteiras foram excluídas dos totais de entradas e saídas.",
                        "neutral"));
            }

            actions.add(item(
                    english ? "Review the largest outflow month" : "Revise o mês com mais saídas",
                    english ? "Compare that month with your routine and choose one realistic spending limit for the next cycle."
                            : "Compare esse mês com sua rotina e defina um limite de consumo realista para o próximo ciclo.",
                    "neutral", "BCB_EDUCACAO", "ME_POUPE"));
            actions.add(item(
                    english ? "Connect spending to priorities" : "Conecte consumo e prioridades",
                    english ? "Before repeating a purchase, check whether it supports the goals you value most."
                            : "Antes de repetir uma compra, avalie se ela contribui para os objetivos que você mais valoriza.",
                    "neutral", "PSYCHOLOGY_MONEY"));
        }

        return new GeneratedNarrative(
                english ? "Your cash flow, with context" : "Seu fluxo de caixa, com contexto",
                english ? "A concise reading of the movements recorded in your simulated wallets."
                        : "Uma leitura objetiva das movimentações registradas nas suas carteiras simuladas.",
                List.copyOf(observations), List.copyOf(actions));
    }

    private GeneratedNarrative.NarrativeItem item(String title, String body, String tone, String... citations) {
        return new GeneratedNarrative.NarrativeItem(title, body, tone, List.of(citations));
    }

    private boolean isUsable(GeneratedNarrative narrative) {
        return narrative.headline() != null && !narrative.headline().isBlank()
                && narrative.summary() != null && !narrative.summary().isBlank();
    }

    private InsightReportResponse toResponse(
            FinancialSnapshot snapshot,
            GeneratedNarrative narrative,
            String provider,
            String language,
            com.github.yildizmy.service.future.BankDataFreshness.Status bankData
    ) {
        boolean english = "en".equals(language);
        return new InsightReportResponse(
                provider,
                snapshot.periodMonths(),
                clock.instant(),
                narrative.headline(),
                narrative.summary(),
                new InsightReportResponse.FinancialMetrics(snapshot.inflow(), snapshot.outflow(),
                        snapshot.internalTransfers(), snapshot.netFlow(), snapshot.transactionCount()),
                snapshot.monthlyFlow().stream()
                        .map(flow -> new InsightReportResponse.MonthlyFlow(flow.month(), flow.inflow(), flow.outflow()))
                        .toList(),
                mapItems(narrative.observations()),
                mapItems(narrative.recommendedActions()),
                references(english),
                english
                        ? "Educational information based on simulated data. It is not individualized financial, investment, credit, legal or tax advice."
                        : "Conteúdo informativo baseado em dados simulados. Não é recomendação individual de investimento, crédito, jurídica, tributária ou financeira.",
                english
                        ? "Only aggregate totals by period and operation direction are processed. Names, emails, wallet codes and transaction descriptions are not sent to the AI provider."
                        : "Apenas totais agregados por período e direção da operação são processados. Nomes, e-mails, códigos de carteira e descrições do extrato não são enviados ao provedor de IA.",
                bankData
        );
    }

    private List<InsightReportResponse.InsightItem> mapItems(List<GeneratedNarrative.NarrativeItem> items) {
        if (items == null) return List.of();
        return items.stream()
                .map(item -> new InsightReportResponse.InsightItem(
                        item.title(), item.body(), item.tone(), item.citationIds() == null ? List.of() : item.citationIds()))
                .toList();
    }

    private List<InsightReportResponse.InsightReference> references(boolean english) {
        return List.of(
                new InsightReportResponse.InsightReference(
                        "BCB_EDUCACAO", "Cidadania Financeira", "Banco Central do Brasil", null,
                        "https://www.bcb.gov.br/cidadaniafinanceira",
                        english ? "Official material on budgeting, responsible consumption and financial planning."
                                : "Material oficial sobre orçamento, consumo consciente e planejamento financeiro."),
                new InsightReportResponse.InsightReference(
                        "PSYCHOLOGY_MONEY", "The Psychology of Money", "Morgan Housel", 2020,
                        "https://www.harriman-house.com/authors/morgan-housel/the-psychology-of-money/9780857197689",
                        english ? "Behavioral perspective on personal financial decisions."
                                : "Perspectiva comportamental sobre decisões financeiras pessoais."),
                new InsightReportResponse.InsightReference(
                        "ME_POUPE", "Me Poupe! (edição atualizada)", "Nathalia Arcuri", 2020,
                        "https://sextante.com.br/products/me-poupe-edicao-atualizada",
                        english ? "Practical exercises for goals, priorities and everyday organization."
                                : "Exercícios práticos sobre metas, prioridades e organização do dia a dia."),
                new InsightReportResponse.InsightReference(
                        "BCB_CALCULATOR", "Calculadora do Cidadão — depósitos regulares", "Banco Central do Brasil", null,
                        "https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaAplicacaoDepositosRegulares.do?method=exibirMetodologiaAplicacaoDepositosRegulares",
                        english ? "Official method for simulating equal regular deposits at a stated rate."
                                : "Metodologia oficial para simular depósitos regulares iguais a uma taxa informada."),
                new InsightReportResponse.InsightReference(
                        "OECD_LITERACY", "OECD/INFE 2023 International Survey of Adult Financial Literacy", "OECD", 2023,
                        "https://www.oecd.org/en/publications/oecd-infe-2023-international-survey-of-adult-financial-literacy_56003a32-en.html",
                        english ? "Research on financial knowledge, behavior, attitudes, inclusion and well-being in 39 economies."
                                : "Pesquisa sobre conhecimento, comportamento, atitudes, inclusão e bem-estar financeiro em 39 economias."),
                new InsightReportResponse.InsightReference(
                        "CFPB_WELLBEING", "Financial Well-Being Scale", "Consumer Financial Protection Bureau", 2023,
                        "https://www.consumerfinance.gov/data-research/research-reports/financial-well-being-scale/",
                        english ? "Research-based framework for financial security and freedom of choice."
                                : "Estrutura baseada em pesquisa sobre segurança financeira e liberdade de escolha.")
        );
    }

    private Map<String, String> researchContext(boolean english) {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("BCB_EDUCACAO", english
                ? "Central Bank of Brazil: official materials cover budgeting, planned consumption, active saving and risk prevention."
                : "Banco Central do Brasil: materiais oficiais abordam orçamento, consumo planejado, poupança ativa e prevenção de riscos.");
        sources.put("BCB_CALCULATOR", english
                ? "Central Bank of Brazil methodology: future value simulations use equal regular deposits, a stated rate and a stated number of months; results are simulations, not promised returns."
                : "Metodologia do Banco Central: simulações de valor futuro usam depósitos regulares iguais, taxa informada e número de meses; o resultado é simulação, não promessa de rendimento.");
        sources.put("OECD_LITERACY", english
                ? "OECD/INFE 2023 survey: financial literacy assessment covers knowledge, behavior, attitudes, inclusion, digital literacy and financial well-being across 39 economies."
                : "Pesquisa OECD/INFE 2023: a avaliação de letramento financeiro abrange conhecimento, comportamento, atitudes, inclusão, letramento digital e bem-estar em 39 economias.");
        sources.put("CFPB_WELLBEING", english
                ? "CFPB research framework defines financial well-being around financial security and freedom of choice in the present and future."
                : "A estrutura de pesquisa do CFPB trata bem-estar financeiro como segurança financeira e liberdade de escolha no presente e no futuro.");
        sources.put("PSYCHOLOGY_MONEY", english
                ? "Morgan Housel, The Psychology of Money (2020): publisher synopsis frames personal finance as strongly influenced by behavior and personal experience."
                : "Morgan Housel, The Psychology of Money (2020): a sinopse da editora apresenta finanças pessoais como fortemente influenciadas por comportamento e experiência.");
        sources.put("ME_POUPE", english
                ? "Nathalia Arcuri, Me Poupe! updated edition (2020): publisher synopsis emphasizes practical exercises, priorities and everyday saving."
                : "Nathalia Arcuri, Me Poupe! edição atualizada (2020): a sinopse da editora enfatiza exercícios práticos, prioridades e economia no dia a dia.");
        return sources;
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    private static class MutableFlow {
        private BigDecimal inflow = BigDecimal.ZERO;
        private BigDecimal outflow = BigDecimal.ZERO;
    }
}
