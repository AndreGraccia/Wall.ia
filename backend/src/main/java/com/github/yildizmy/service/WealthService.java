package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CreditCard;
import com.github.yildizmy.domain.entity.Investment;
import com.github.yildizmy.domain.entity.InvestmentValue;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.dto.request.WealthRequests;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.dto.response.WealthResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.InvestmentRepository;
import com.github.yildizmy.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Patrimônio (ADR 0026): account balances + investments the person informed - known debts. Informative: no quote,
 * no advice, and nothing here feeds the available balance or the projection.
 */
@Service
@RequiredArgsConstructor
public class WealthService {

    static final int MAX_INVESTMENTS = 50;
    static final int MAX_VALUES = 120;
    private static final LocalDate EARLIEST = LocalDate.of(1970, 1, 1);
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final InvestmentRepository investments;
    private final WalletRepository wallets;
    private final CreditCardRepository cards;
    private final FutureService futureService;
    private final UserService userService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public WealthResponses.Wealth view(long userId) {
        LocalDate today = today();
        List<WealthResponses.Account> accounts = wallets.findByUserId(userId).stream()
                .sorted(Comparator.comparing(Wallet::getId))
                .map(wallet -> toAccount(wallet, today))
                .toList();
        List<WealthResponses.Investment> informed = investments.findByUserIdOrderById(userId).stream()
                .map(WealthService::toResponse).toList();
        List<WealthResponses.Debt> debts = debts(userId);

        BigDecimal accountsTotal = sum(accounts, WealthResponses.Account::balance);
        BigDecimal investmentsTotal = sum(informed, WealthResponses.Investment::value);
        BigDecimal debtsTotal = sum(debts, WealthResponses.Debt::amount);
        boolean pixOverlap = debts.stream().anyMatch(debt -> "CARD".equals(debt.kind()))
                && debts.stream().anyMatch(debt -> "MANUAL".equals(debt.kind()));
        return new WealthResponses.Wealth(today, accountsTotal.add(investmentsTotal).subtract(debtsTotal),
                accountsTotal, investmentsTotal, debtsTotal, accounts, informed, debts, evolution(informed), pixOverlap);
    }

    @Transactional
    public WealthResponses.Wealth create(long userId, WealthRequests.NewInvestment request) {
        userService.lockForUpdate(userId);
        if (investments.countByUserId(userId) >= MAX_INVESTMENTS) throw new WalletRuleException("INVESTMENT_LIMIT");
        checkDate(request.valueDate());
        Investment investment = new Investment();
        investment.setUser(userService.getReferenceById(userId));
        investment.setCreatedAt(clock.instant());
        apply(investment, request.details());
        investment.getValues().add(new InvestmentValue(investment, request.valueDate(), cents(request.value())));
        investments.save(investment);
        return view(userId);
    }

    @Transactional
    public WealthResponses.Wealth update(long userId, long id, WealthRequests.Details request) {
        apply(owned(userId, id), request);
        return view(userId);
    }

    /** Informs the value on a date; informing the same date again corrects it. */
    @Transactional
    public WealthResponses.Wealth putValue(long userId, long id, WealthRequests.Value request) {
        userService.lockForUpdate(userId);
        Investment investment = owned(userId, id);
        checkDate(request.valueDate());
        BigDecimal amount = cents(request.value());
        investment.getValues().stream()
                .filter(value -> value.getValueDate().equals(request.valueDate()))
                .findFirst()
                .ifPresentOrElse(value -> value.setAmount(amount), () -> {
                    if (investment.getValues().size() >= MAX_VALUES) {
                        throw new WalletRuleException("INVESTMENT_VALUE_LIMIT");
                    }
                    investment.getValues().add(new InvestmentValue(investment, request.valueDate(), amount));
                });
        return view(userId);
    }

    /** Undoes a value informed by mistake. An investment keeps at least one. */
    @Transactional
    public WealthResponses.Wealth deleteValue(long userId, long id, LocalDate date) {
        userService.lockForUpdate(userId);
        Investment investment = owned(userId, id);
        InvestmentValue value = investment.getValues().stream()
                .filter(candidate -> candidate.getValueDate().equals(date))
                .findFirst()
                .orElseThrow(() -> new WalletRuleException("INVESTMENT_VALUE_NOT_FOUND"));
        if (investment.getValues().size() == 1) throw new WalletRuleException("INVESTMENT_LAST_VALUE");
        investment.getValues().remove(value);
        return view(userId);
    }

    @Transactional
    public WealthResponses.Wealth delete(long userId, long id) {
        investments.delete(owned(userId, id));
        return view(userId);
    }

    /** Cards, loans and typed debts as the Commitments screen computes them, so the two screens never disagree. */
    private List<WealthResponses.Debt> debts(long userId) {
        FutureResponses.Commitments commitments = futureService.commitments(userId);
        Map<Long, Instant> cardSync = new HashMap<>();
        for (CreditCard card : cards.findByUserIdOrderById(userId)) cardSync.put(card.getId(), card.getLastSyncedAt());
        List<WealthResponses.Debt> debts = new ArrayList<>();
        commitments.cards().forEach(card -> debts.add(new WealthResponses.Debt("CARD", card.id(), card.name(),
                card.institution(), card.committedLimit(), date(cardSync.get(card.id())))));
        commitments.loans().forEach(loan -> debts.add(new WealthResponses.Debt("LOAN", loan.id(), loan.product(),
                loan.institution(), loan.outstandingBalance(), date(loan.lastSyncedAt()))));
        commitments.manualDebts().forEach(debt -> debts.add(new WealthResponses.Debt("MANUAL", debt.id(),
                debt.label(), null, debt.outstandingBalance(), date(debt.createdAt()))));
        debts.removeIf(debt -> debt.amount() == null || debt.amount().signum() <= 0);
        return debts;
    }

    /** On each informed date, every investment counts with its latest value up to that date. */
    static List<WealthResponses.Point> evolution(List<WealthResponses.Investment> informed) {
        List<NavigableMap<LocalDate, BigDecimal>> histories = new ArrayList<>();
        TreeSet<LocalDate> dates = new TreeSet<>();
        for (WealthResponses.Investment investment : informed) {
            NavigableMap<LocalDate, BigDecimal> history = new TreeMap<>();
            investment.history().forEach(point -> history.put(point.date(), point.amount()));
            histories.add(history);
            dates.addAll(history.keySet());
        }
        return dates.stream().map(date -> new WealthResponses.Point(date, sum(histories, history -> {
            var entry = history.floorEntry(date);
            return entry == null ? BigDecimal.ZERO : entry.getValue();
        }))).toList();
    }

    private Investment owned(long userId, long id) {
        return investments.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new WalletRuleException("INVESTMENT_NOT_FOUND"));
    }

    private void checkDate(LocalDate date) {
        if (date.isAfter(today())) throw new WalletRuleException("INVESTMENT_FUTURE_DATE");
        if (date.isBefore(EARLIEST)) throw new WalletRuleException("INVALID_DATE");
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    private static void apply(Investment investment, WealthRequests.Details details) {
        investment.setInstitution(details.institution().trim());
        investment.setName(details.name().trim());
        investment.setAssetClass(details.assetClass());
        investment.setInvestedAmount(details.investedAmount() == null ? null : cents(details.investedAmount()));
        investment.setMaturityDate(details.maturityDate());
        investment.setNote(details.note() == null || details.note().isBlank() ? null : details.note().trim());
    }

    private static WealthResponses.Account toAccount(Wallet wallet, LocalDate today) {
        boolean bank = wallet.getSource() == WalletSource.OPEN_FINANCE;
        return new WealthResponses.Account(wallet.getId(), wallet.getName(), wallet.getInstitutionName(),
                wallet.getSource().name(), cents(wallet.getBalance()), bank ? date(wallet.getLastSyncedAt()) : today);
    }

    private static WealthResponses.Investment toResponse(Investment investment) {
        // Sorted here too: a value added in this transaction sits at the end of the list, whatever its date.
        List<WealthResponses.Point> history = investment.getValues().stream()
                .map(value -> new WealthResponses.Point(value.getValueDate(), value.getAmount()))
                .sorted(Comparator.comparing(WealthResponses.Point::date))
                .toList();
        WealthResponses.Point current = history.get(history.size() - 1);
        return new WealthResponses.Investment(investment.getId(), investment.getInstitution(), investment.getName(),
                investment.getAssetClass(), current.amount(), current.date(), investment.getInvestedAmount(),
                investment.getMaturityDate(), investment.getNote(), history);
    }

    private static LocalDate date(Instant instant) {
        return instant == null ? null : LocalDate.ofInstant(instant, ZONE);
    }

    private static BigDecimal cents(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_EVEN);
    }

    private static <T> BigDecimal sum(List<T> items, Function<T, BigDecimal> amount) {
        return cents(items.stream().map(amount).reduce(BigDecimal.ZERO, BigDecimal::add));
    }
}
