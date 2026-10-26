package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CreditCard;
import com.github.yildizmy.domain.entity.Loan;
import com.github.yildizmy.domain.entity.RecurrenceDecision;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.RecurrenceStatus;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import com.github.yildizmy.dto.request.FutureRequests;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.dto.response.BillingRadarPriceImpact;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.domain.entity.Envelope;
import com.github.yildizmy.domain.entity.Goal;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.future.BillingRadarDetector;
import com.github.yildizmy.service.future.CardPlan;
import com.github.yildizmy.service.future.CashEvent;
import com.github.yildizmy.service.future.CashEventPlanner;
import com.github.yildizmy.service.future.CashEventPlanner.ConfirmedRecurrence;
import com.github.yildizmy.service.future.DailySpending;
import com.github.yildizmy.service.future.ExitPlan;
import com.github.yildizmy.service.future.LoanCost;
import com.github.yildizmy.service.future.LoanPlan;
import com.github.yildizmy.service.future.OverdraftCost;
import com.github.yildizmy.service.future.ProjectionEngine;
import com.github.yildizmy.service.future.PriceReversionScenario;
import com.github.yildizmy.service.future.QuestionParser;
import com.github.yildizmy.service.future.RecurrenceDetector;
import com.github.yildizmy.service.future.RecurrenceDetector.Category;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import com.github.yildizmy.service.future.RecurrenceDetector.RecurrencePattern;
import com.github.yildizmy.service.future.ScenarioSimulator;
import com.github.yildizmy.service.future.SpendingLimit;
import com.github.yildizmy.service.market.MarketRatesService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Application service for "Futuro": loads the user's data, runs the deterministic engine and
 * maps the result. Java calculates here; the AI layer may only read these results.
 */
@Service
public class FutureService {

    static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    static final int COMMITTED_WINDOW_DAYS = 30;
    static final int SCENARIO_HORIZON_DAYS = 90;
    private static final long TYPE_DEPOSIT = 4L;
    private static final long TYPE_WITHDRAWAL = 5L;
    private static final Set<String> INCOME_CATEGORIES = Set.of("SALARY", "OTHER_INCOME");
    private static final Set<String> EXPENSE_CATEGORIES = Set.of("RENT", "SUBSCRIPTION", "BILL", "OTHER");
    /** Decision row that stores the everyday-spending answer; pattern keys always start with "in:" or "out:". */
    static final String DAILY_SPENDING_KEY = "daily-spending";
    /** Category of an entry the bank itself scheduled (Open Finance LANCAMENTO_FUTURO). */
    static final String SCHEDULED = "SCHEDULED";
    static final int SAME_BILL_DAYS = 5;
    /** History the engine reads: a year of recurrences plus a month of margin. */
    static final int HISTORY_MONTHS = 13;
    static final String CARD_SPENDING_KEY = "card-spending";

    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final RecurrenceDecisionRepository decisionRepository;
    private final CreditCardRepository creditCardRepository;
    private final LoanRepository loanRepository;
    private final GoalRepository goalRepository;
    private final EnvelopeRepository envelopeRepository;
    private final UserService userService;
    private final MarketRatesService marketRates;
    private final Clock clock;

    public FutureService(
            WalletRepository walletRepository,
            TransactionRepository transactionRepository,
            RecurrenceDecisionRepository decisionRepository,
            CreditCardRepository creditCardRepository,
            LoanRepository loanRepository,
            GoalRepository goalRepository,
            EnvelopeRepository envelopeRepository,
            UserService userService,
            MarketRatesService marketRates,
            Clock clock) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.decisionRepository = decisionRepository;
        this.creditCardRepository = creditCardRepository;
        this.loanRepository = loanRepository;
        this.goalRepository = goalRepository;
        this.envelopeRepository = envelopeRepository;
        this.userService = userService;
        this.marketRates = marketRates;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public FutureResponses.Overview overview(long userId, int horizonDays) {
        Context context = load(userId);
        LocalDate end = context.today().plusDays(horizonDays);
        List<CashEvent> events = context.plan(end);
        ProjectionEngine.Projection projection = ProjectionEngine.project(context.today(), context.balance(), events, horizonDays);

        LocalDate committedUntil = context.today().plusDays(COMMITTED_WINDOW_DAYS);
        // Envelopes are a floor: the limit is what can be spent without touching them. The projection and the
        // negative windows keep the real balance, because the bank does not know about envelopes.
        SpendingLimit.Limit limit = SpendingLimit.compute(context.today(), context.balance().subtract(context.reserved()),
                context.planForLimit(context.today().plusDays(SpendingLimit.MAX_DAYS)));
        // "Already has a destination" is bills, invoices and instalments; future groceries are not committed yet.
        List<CashEvent> committedEvents = context.planFixed(committedUntil).stream()
                .filter(event -> !event.isInflow())
                .sorted(Comparator.comparing(CashEvent::date))
                .toList();
        FutureResponses.Committed committed = committed(committedUntil, committedEvents);

        long pending = context.patterns().stream().filter(pattern -> !context.decisions().containsKey(pattern.key())).count();
        return new FutureResponses.Overview(
                clock.instant(),
                context.today(),
                context.balance(),
                context.balance().subtract(committed.total()).subtract(context.reserved()),
                committed,
                toResponse(projection, horizonDays, marketRates.overdraftRate(userId)),
                new FutureResponses.Sources(
                        context.wallets().size(),
                        context.cards().size(),
                        context.loans().size(),
                        context.confirmed().size(),
                        (int) pending,
                        bankDataAsOf(context.wallets()),
                        bankDataStale(bankDataAsOf(context.wallets()), clock.instant())
                ),
                spendingQuestion(context, DAILY_SPENDING_KEY, context.dailyEstimate(), context.dailyAmount()),
                context.cardPlans().isEmpty() ? null
                        : spendingQuestion(context, CARD_SPENDING_KEY, context.cardEstimate(), context.cardAmount()),
                new FutureResponses.SpendingLimit(
                        limit.daily(),
                        limit.until(),
                        limit.untilIncome(),
                        limit.days(),
                        limit.bindingDate(),
                        context.dailyAmount(),
                        context.dailyAmount() == null ? null : limit.daily().subtract(context.dailyAmount()),
                        limit.shortfall(),
                        context.reserved()),
                ExitPlan.suggest(context.today(), context.balance(), events, horizonDays, context.dailyAmount(),
                                context.reserved()).stream()
                        .map(action -> new FutureResponses.ExitAction(action.type(), action.label(), action.category(),
                                action.amount(), action.from(), action.to(), action.newDaily(),
                                action.resultingLowest(), action.solves()))
                        .toList(),
                context.reserved()
        );
    }

    /**
     * Answer to "is this your everyday spending?" for the account ({@code source} ACCOUNT, default) or the
     * credit card (CARD). PENDING removes the answer; CONFIRMED may carry the user's own daily value,
     * otherwise the estimate from the history is used.
     */
    @Transactional
    public void decideDailySpending(long userId, FutureRequests.DailySpendingDecision request) {
        boolean card = "CARD".equals(request.source());
        String key = card ? CARD_SPENDING_KEY : DAILY_SPENDING_KEY;
        var existing = decisionRepository.findByUserIdAndPatternKey(userId, key);
        if ("PENDING".equals(request.status())) {
            existing.ifPresent(decisionRepository::delete);
            return;
        }
        Context context = load(userId);
        if (card && context.cardPlans().isEmpty()) throw new WalletRuleException("CARD_SPENDING_NO_CARD");
        Optional<DailySpending.Estimate> estimate = card ? context.cardEstimate() : context.dailyEstimate();
        if (estimate.isEmpty() && request.dailyAmount() == null) {
            throw new WalletRuleException("DAILY_SPENDING_NO_HISTORY");
        }
        RecurrenceDecision decision = existing.orElseGet(RecurrenceDecision::new);
        decision.setUser(userService.getReferenceById(userId));
        decision.setPatternKey(key);
        decision.setStatus(RecurrenceStatus.valueOf(request.status()));
        decision.setCategory(card ? CashEventPlanner.CARD_SPENDING : CashEventPlanner.DAILY_SPENDING);
        decision.setAmount("CONFIRMED".equals(request.status()) ? request.dailyAmount() : null);
        decision.setDecidedAt(clock.instant());
        decisionRepository.save(decision);
    }

    private FutureResponses.DailySpending spendingQuestion(Context context, String key,
                                                          Optional<DailySpending.Estimate> estimate, BigDecimal applied) {
        RecurrenceDecision decision = context.decisions().get(key);
        String status = decision == null ? "PENDING" : decision.getStatus().name();
        // Confirmed "use the estimate", but there is no estimate any more (e.g. 90 days without movements).
        if ("CONFIRMED".equals(status) && applied == null) status = "PENDING";
        return new FutureResponses.DailySpending(
                status,
                estimate.map(DailySpending.Estimate::daily).orElse(null),
                applied,
                decision == null ? null : decision.getAmount(),
                estimate.map(DailySpending.Estimate::total).orElse(null),
                estimate.map(DailySpending.Estimate::days).orElse(0),
                estimate.map(DailySpending.Estimate::movements).orElse(0),
                estimate.map(item -> item.top().stream()
                        .map(top -> new FutureResponses.SpendingItem(top.counterparty(), top.total(), top.count()))
                        .toList()).orElse(List.of())
        );
    }

    @Transactional(readOnly = true)
    public List<FutureResponses.Recurrence> recurrences(long userId) {
        Context context = load(userId);
        return context.patterns().stream().map(pattern -> {
            RecurrenceDecision decision = context.decisions().get(pattern.key());
            return new FutureResponses.Recurrence(
                    pattern.key(),
                    pattern.counterparty(),
                    LabelKeys.label(pattern.counterparty()),
                    pattern.direction().name(),
                    pattern.accountName(),
                    pattern.institution(),
                    pattern.typicalAmount(),
                    pattern.fixedAmount(),
                    pattern.typicalDay(),
                    pattern.confidence().name(),
                    pattern.suggestedCategory().name(),
                    decision == null ? "PENDING" : decision.getStatus().name(),
                    decision == null ? null : decision.getCategory(),
                    decision == null ? null : decision.getDecidedAt(),
                    pattern.occurrences().stream()
                            .map(item -> new FutureResponses.Occurrence(item.transactionId(), item.date(), item.amount()))
                            .toList()
            );
        }).toList();
    }

    @Transactional
    public void decide(long userId, FutureRequests.RecurrenceDecision request) {
        RecurrencePattern pattern = RecurrenceDetector.detect(movements(userId, walletRepository.findByUserId(userId))).stream()
                .filter(item -> item.key().equals(request.key()))
                .findFirst()
                .orElseThrow(() -> new WalletRuleException("RECURRENCE_NOT_FOUND"));

        var existing = decisionRepository.findByUserIdAndPatternKey(userId, pattern.key());
        if ("PENDING".equals(request.status())) {
            existing.ifPresent(decisionRepository::delete);
            return;
        }
        String category = request.category() == null ? pattern.suggestedCategory().name() : request.category();
        Set<String> allowed = pattern.direction() == Direction.IN ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        if (!allowed.contains(category)) throw new WalletRuleException("RECURRENCE_CATEGORY_MISMATCH");

        RecurrenceDecision decision = existing.orElseGet(RecurrenceDecision::new);
        decision.setUser(userService.getReferenceById(userId));
        decision.setPatternKey(pattern.key());
        decision.setStatus(RecurrenceStatus.valueOf(request.status()));
        decision.setCategory(category);
        decision.setDecidedAt(clock.instant());
        decisionRepository.save(decision);
    }

    /** In what order to pay the loans off with {@code extra} more a month, and what each order saves (ADR 0013). */
    @Transactional(readOnly = true)
    public FutureResponses.DebtPayoff debtPayoff(long userId, BigDecimal extra) {
        // Scale and precision first: "1e-40000000" is in range, and any arithmetic on it burns seconds of CPU.
        if (extra == null || extra.scale() > 2 || extra.precision() > 12
                || extra.signum() < 0 || extra.compareTo(new BigDecimal("1000000")) > 0) {
            throw new WalletRuleException("INVALID_AMOUNT");
        }
        List<com.github.yildizmy.service.future.DebtPayoff.Debt> debts = new java.util.ArrayList<>();
        int withoutRate = 0;
        for (var loan : loanRepository.findByUserIdOrderById(userId)) {
            if (loan.getOutstandingBalance() == null || loan.getOutstandingBalance().signum() <= 0) continue;
            if (loan.getInstallmentAmount() == null || loan.getInstallmentAmount().signum() <= 0
                    || loan.getAnnualRate() == null) {
                withoutRate++;
                continue;
            }
            debts.add(new com.github.yildizmy.service.future.DebtPayoff.Debt(
                    String.valueOf(loan.getId()),
                    loan.getProduct() + " - " + loan.getInstitution(),
                    loan.getOutstandingBalance(),
                    loan.getInstallmentAmount(),
                    loan.getAnnualRate()));
        }
        return new FutureResponses.DebtPayoff(
                com.github.yildizmy.service.future.DebtPayoff.compare(debts, extra.setScale(2, java.math.RoundingMode.HALF_UP)),
                withoutRate);
    }

    @Transactional(readOnly = true)
    public FutureResponses.Commitments commitments(long userId) {
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        List<FutureResponses.Card> cards = creditCardRepository.findByUserIdOrderById(userId).stream()
                .map(card -> toResponse(toPlan(card), card, today))
                .toList();
        List<FutureResponses.Loan> loans = loanRepository.findByUserIdOrderById(userId).stream()
                .map(loan -> {
                    LoanPlan plan = toPlan(loan);
                    List<LocalDate> dues = plan.dueDates();
                    return new FutureResponses.Loan(
                            loan.getId(),
                            loan.getProduct(),
                            loan.getInstitution(),
                            loan.getContractedAmount(),
                            loan.getOutstandingBalance(),
                            loan.getInstallmentAmount(),
                            loan.getInstallmentsTotal(),
                            loan.getInstallmentsPaid(),
                            plan.remainingInstallments(),
                            loan.getNextDueDate(),
                            dues.isEmpty() ? null : dues.get(dues.size() - 1),
                            loan.getAnnualRate(),
                            loan.getLastSyncedAt(),
                            LoanCost.interestRemaining(loan.getAmortizationSystem(), loan.getInstallmentAmount(),
                                    plan.remainingInstallments(), loan.getOutstandingBalance(), loan.getAnnualRate()),
                            LoanCost.nextInstallmentInterest(loan.getOutstandingBalance(), loan.getAnnualRate(),
                                    loan.getInstallmentAmount()),
                            loan.getCet()
                    );
                })
                .toList();
        return new FutureResponses.Commitments(cards, loans);
    }

    @Transactional(readOnly = true)
    public FutureResponses.ScenarioResult simulate(long userId, FutureRequests.Scenario request) {
        ScenarioSimulator.Type type = ScenarioSimulator.Type.valueOf(request.type());
        if (type != ScenarioSimulator.Type.INCOME_LOSS && request.amount() == null) {
            throw new WalletRuleException("INVALID_AMOUNT");
        }
        Context context = load(userId);
        LocalDate end = context.today().plusDays(SCENARIO_HORIZON_DAYS);
        List<CashEvent> baseline = context.plan(end);
        if (type == ScenarioSimulator.Type.INCOME_LOSS && baseline.stream().noneMatch(CashEvent::isInflow)) {
            throw new WalletRuleException("SCENARIO_NO_CONFIRMED_INCOME");
        }

        ScenarioSimulator.Scenario scenario = new ScenarioSimulator.Scenario(
                type,
                request.amount(),
                request.installments() == null ? 1 : request.installments(),
                request.method() == null ? ScenarioSimulator.Method.CASH : ScenarioSimulator.Method.valueOf(request.method()),
                request.cardId(),
                request.dayOfMonth(),
                request.months() == null ? 1 : request.months(),
                request.incomeKey(),
                request.label()
        );
        ScenarioSimulator.Outcome outcome = ScenarioSimulator.apply(scenario, context.today(), end, baseline, context.cardPlans());
        OverdraftCost.Rate overdraftRate = marketRates.overdraftRate(userId);
        ProjectionEngine.Projection before = ProjectionEngine.project(context.today(), context.balance(), baseline, SCENARIO_HORIZON_DAYS);
        ProjectionEngine.Projection after = ProjectionEngine.project(context.today(), context.balance(), outcome.events(), SCENARIO_HORIZON_DAYS);
        return new FutureResponses.ScenarioResult(
                summary(before),
                summary(after),
                outcome.newMonthlyCommitment(),
                outcome.installments(),
                outcome.cardName(),
                toResponse(before, SCENARIO_HORIZON_DAYS, overdraftRate),
                toResponse(after, SCENARIO_HORIZON_DAYS, overdraftRate)
        );
    }

    /**
     * Compares two hypothetical future paths for an observed recurring price increase.
     * The values come from this user's own transaction history; the client cannot supply prices.
     */
    @Transactional(readOnly = true)
    public BillingRadarPriceImpact simulatePriceReversion(long userId, String key) {
        Context context = load(userId);
        BillingRadarDetector.Signal signal = BillingRadarDetector.detect(movements(userId, context.wallets()))
                .stream()
                .filter(candidate -> candidate.key().equals(key))
                .filter(BillingRadarDetector.Signal::priceIncrease)
                .findFirst()
                .orElseThrow(() -> new WalletRuleException("BILLING_RADAR_PRICE_CHANGE_NOT_FOUND"));

        if (signal.baselineAmount() == null || signal.lastChargeDate() == null || signal.nextExpectedDate() == null
                || signal.evidence().isEmpty()) {
            throw new WalletRuleException("BILLING_RADAR_PRICE_CHANGE_NOT_FOUND");
        }

        long observedInterval = ChronoUnit.DAYS.between(signal.lastChargeDate(), signal.nextExpectedDate());
        if (observedInterval < 20 || observedInterval > 40) {
            throw new WalletRuleException("BILLING_RADAR_PRICE_CHANGE_NOT_FOUND");
        }

        BillingRadarDetector.Occurrence latestEvidence = signal.evidence().get(0);
        LocalDate end = context.today().plusDays(SCENARIO_HORIZON_DAYS);
        List<CashEvent> baselineEvents = context.plan(end);
        PriceReversionScenario.Comparison comparison = PriceReversionScenario.build(
                context.today(),
                end,
                baselineEvents,
                signal.key(),
                signal.counterparty(),
                latestEvidence.accountName(),
                latestEvidence.institution(),
                signal.nextExpectedDate(),
                Math.toIntExact(observedInterval),
                signal.latestAmount(),
                signal.baselineAmount()
        );

        ProjectionEngine.Projection keepProjection = ProjectionEngine.project(
                context.today(), context.balance(), comparison.keepCurrentPrice(), SCENARIO_HORIZON_DAYS);
        ProjectionEngine.Projection priorProjection = ProjectionEngine.project(
                context.today(), context.balance(), comparison.returnToPreviousPrice(), SCENARIO_HORIZON_DAYS);
        OverdraftCost.Rate overdraftRate = marketRates.overdraftRate(userId);
        BigDecimal differencePerCharge = signal.latestAmount().subtract(signal.baselineAmount());
        BigDecimal possibleSavings = differencePerCharge.multiply(BigDecimal.valueOf(comparison.chargeDates().size()));

        return new BillingRadarPriceImpact(
                signal.counterparty(),
                signal.latestAmount(),
                signal.baselineAmount(),
                differencePerCharge,
                possibleSavings,
                comparison.chargeDates().size(),
                comparison.chargeDates().get(0),
                comparison.chargeDates().get(comparison.chargeDates().size() - 1),
                summary(keepProjection),
                summary(priorProjection),
                toResponse(keepProjection, SCENARIO_HORIZON_DAYS, overdraftRate),
                toResponse(priorProjection, SCENARIO_HORIZON_DAYS, overdraftRate)
        );
    }

    static final int MAX_GOALS = 10;

    @Transactional(readOnly = true)
    public List<FutureResponses.Goal> goals(long userId) {
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        return goalRepository.findByUserIdOrderById(userId).stream().map(goal -> toResponse(goal, today)).toList();
    }

    @Transactional
    public FutureResponses.Goal createGoal(long userId, FutureRequests.Goal request) {
        userService.lockForUpdate(userId);
        if (goalRepository.countByUserId(userId) >= MAX_GOALS) throw new WalletRuleException("GOAL_LIMIT");
        Goal goal = new Goal();
        goal.setUser(userService.getReferenceById(userId));
        goal.setName(request.name().trim());
        goal.setMonthlyAmount(request.monthlyAmount());
        goal.setDayOfMonth(request.dayOfMonth());
        goal.setCreatedAt(clock.instant());
        goalRepository.save(goal);
        return toResponse(goal, LocalDate.now(clock.withZone(ZONE)));
    }

    static final int MAX_ENVELOPES = 10;

    @Transactional(readOnly = true)
    public FutureResponses.Envelopes envelopes(long userId) {
        List<Envelope> items = envelopeRepository.findByUserIdOrderById(userId);
        BigDecimal reserved = items.stream().map(Envelope::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = walletRepository.findByUserId(userId).stream()
                .map(Wallet::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new FutureResponses.Envelopes(
                items.stream().map(item -> new FutureResponses.Envelope(item.getId(), item.getName(), item.getAmount())).toList(),
                balance,
                reserved,
                reserved.subtract(balance.max(BigDecimal.ZERO)).max(BigDecimal.ZERO));
    }

    @Transactional
    public FutureResponses.Envelope createEnvelope(long userId, FutureRequests.Envelope request) {
        userService.lockForUpdate(userId);
        if (envelopeRepository.countByUserId(userId) >= MAX_ENVELOPES) throw new WalletRuleException("ENVELOPE_LIMIT");
        Envelope envelope = new Envelope();
        envelope.setUser(userService.getReferenceById(userId));
        envelope.setName(request.name().trim());
        envelope.setAmount(request.amount());
        envelope.setCreatedAt(clock.instant());
        envelopeRepository.save(envelope);
        return new FutureResponses.Envelope(envelope.getId(), envelope.getName(), envelope.getAmount());
    }

    @Transactional
    public void deleteEnvelope(long userId, long envelopeId) {
        envelopeRepository.delete(envelopeRepository.findByIdAndUserId(envelopeId, userId)
                .orElseThrow(() -> new WalletRuleException("ENVELOPE_NOT_FOUND")));
    }

    @Transactional
    public void deleteGoal(long userId, long goalId) {
        goalRepository.delete(goalRepository.findByIdAndUserId(goalId, userId)
                .orElseThrow(() -> new WalletRuleException("GOAL_NOT_FOUND")));
    }

    private FutureResponses.Goal toResponse(Goal goal, LocalDate today) {
        LocalDate next = CashEventPlanner.goals(List.of(toPlan(goal)), today, today.plusMonths(2)).stream()
                .map(CashEvent::date).findFirst().orElse(null);
        return new FutureResponses.Goal(goal.getId(), goal.getName(), goal.getMonthlyAmount(), goal.getDayOfMonth(), next);
    }

    private CashEventPlanner.GoalPlan toPlan(Goal goal) {
        return new CashEventPlanner.GoalPlan(goal.getId(), goal.getName(), goal.getMonthlyAmount(), goal.getDayOfMonth());
    }

    /** How far "Pergunte à Wall.ia" looks for risks and the next income. */
    static final int ASK_HORIZON_DAYS = 60;

    /**
     * "Pergunte à Wall.ia": picks the calculation that answers the question and returns its numbers.
     * Nothing is written and nothing is invented: an unknown question returns UNKNOWN.
     */
    @Transactional(readOnly = true)
    public FutureResponses.Answer ask(long userId, String question) {
        QuestionParser.Parsed parsed = QuestionParser.parse(question);
        FutureResponses.Overview overview = overview(userId, ASK_HORIZON_DAYS);
        String intent = parsed.intent().name();
        String method = parsed.card() ? "CARD" : "CASH";
        return switch (parsed.intent()) {
            case PURCHASE -> {
                if (parsed.amount() == null) {
                    yield answer(intent, parsed, method, "NEED_AMOUNT", overview, null, null, null, null, null, null, null);
                }
                if (parsed.installments() < 1 || parsed.installments() > QuestionParser.MAX_INSTALLMENTS) {
                    yield answer(intent, parsed, method, "INVALID_INSTALLMENTS", overview, null, null, null, null, null, null, null);
                }
                FutureResponses.ScenarioResult result = simulate(userId, new FutureRequests.Scenario(
                        "PURCHASE", parsed.amount(), parsed.installments(), method, null, null, null, null, "Pergunta"));
                yield answer(intent, parsed, method, verdict(result, overview.spendingLimit()), overview,
                        overview.spendingLimit(), null, null, null, result, result.newMonthlyCommitment(), result.cardName());
            }
            case DAILY_LIMIT -> answer(intent, parsed, method, null, overview, overview.spendingLimit(),
                    null, null, null, null, null, null);
            case WHY_NEGATIVE -> answer(intent, parsed, method, null, overview, overview.spendingLimit(),
                    overview.projection().riskWindows().stream().findFirst().orElse(null), null, null, null, null, null);
            case COMMITTED -> answer(intent, parsed, method, null, overview, null, null, overview.committed(),
                    null, null, null, null);
            case NEXT_INCOME -> answer(intent, parsed, method, null, overview, null, null, null,
                    overview.projection().events().stream().filter(event -> event.amount().signum() > 0)
                            .findFirst().orElse(null), null, null, null);
            case UNKNOWN -> answer(intent, parsed, method, null, overview, null, null, null, null, null, null, null);
        };
    }

    /**
     * RISK when the purchase adds negative days or deepens a hole that already exists; TIGHT when it leaves
     * the lowest point below a week of everyday spending (or keeps existing negative days as they are); SAFE otherwise.
     */
    static String verdict(FutureResponses.ScenarioResult result, FutureResponses.SpendingLimit limit) {
        FutureResponses.ScenarioSummary before = result.baseline();
        FutureResponses.ScenarioSummary after = result.scenario();
        if (after.negativeDays() > before.negativeDays()) return "RISK";
        // Negative days saturate when the whole horizon is already below zero: a deeper hole is still a risk.
        if (before.negativeDays() > 0 && after.minBalance90().compareTo(before.minBalance90()) < 0) return "RISK";
        BigDecimal weekBuffer = limit == null || limit.pace() == null
                ? BigDecimal.ZERO
                : limit.pace().multiply(BigDecimal.valueOf(7));
        // A purchase that would eat into the envelopes is not "safe", even if the account never goes negative.
        if (limit != null && limit.reserved() != null) weekBuffer = weekBuffer.add(limit.reserved());
        if (after.negativeDays() > 0 || after.minBalance90().compareTo(weekBuffer) < 0) return "TIGHT";
        return "SAFE";
    }

    private FutureResponses.Answer answer(String intent, QuestionParser.Parsed parsed, String method, String verdict,
                                          FutureResponses.Overview overview, FutureResponses.SpendingLimit limit,
                                          FutureResponses.RiskWindow risk, FutureResponses.Committed committed,
                                          FutureResponses.Event nextIncome, FutureResponses.ScenarioResult scenario,
                                          BigDecimal newMonthlyCommitment, String cardName) {
        return new FutureResponses.Answer(
                intent,
                parsed.amount(),
                parsed.installments(),
                method,
                verdict,
                overview.balance(),
                limit,
                risk,
                committed,
                nextIncome,
                scenario == null ? null : scenario.baseline(),
                scenario == null ? null : scenario.scenario(),
                newMonthlyCommitment,
                cardName,
                "WHY_NEGATIVE".equals(intent) ? overview.exitPlan() : null);
    }

    // --- loading -----------------------------------------------------------------------------

    private Context load(long userId) {
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        List<Wallet> wallets = walletRepository.findByUserId(userId);
        BigDecimal balance = wallets.stream().map(Wallet::getBalance).reduce(BigDecimal.ZERO, BigDecimal::add);
        // Recurrences look back up to a year; everyday spending 90 days. Older history changes nothing here.
        List<Transaction> transactions = transactionRepository.findAllByUserIdSince(userId,
                today.minusMonths(HISTORY_MONTHS).atStartOfDay(ZONE).toInstant());
        List<Movement> movements = movements(transactions, wallets);
        List<RecurrencePattern> patterns = RecurrenceDetector.detect(movements);
        Map<String, RecurrenceDecision> decisions = decisionRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(RecurrenceDecision::getPatternKey, Function.identity()));
        List<ConfirmedRecurrence> confirmed = patterns.stream()
                .filter(pattern -> {
                    RecurrenceDecision decision = decisions.get(pattern.key());
                    return decision != null && decision.getStatus() == RecurrenceStatus.CONFIRMED;
                })
                .map(pattern -> new ConfirmedRecurrence(pattern, Category.valueOf(decisions.get(pattern.key()).getCategory())))
                .toList();
        List<CreditCard> cards = creditCardRepository.findByUserIdOrderById(userId);
        List<Loan> loans = loanRepository.findByUserIdOrderById(userId);

        // Bills already projected (confirmed) or still being asked about (pending) are not everyday spending.
        Set<String> fixedKeys = patterns.stream()
                .filter(pattern -> {
                    RecurrenceDecision decision = decisions.get(pattern.key());
                    return decision == null || decision.getStatus() == RecurrenceStatus.CONFIRMED;
                })
                .map(RecurrencePattern::key)
                .collect(Collectors.toSet());
        Optional<DailySpending.Estimate> dailyEstimate = DailySpending.estimate(today, movements, fixedKeys);
        BigDecimal dailyAmount = applied(decisions.get(DAILY_SPENDING_KEY), dailyEstimate);
        List<CardPlan> cardPlans = cards.stream().map(this::toPlan).toList();
        Optional<DailySpending.Estimate> cardEstimate = DailySpending.estimateCard(today, cardPlans);
        BigDecimal cardAmount = applied(decisions.get(CARD_SPENDING_KEY), cardEstimate);
        List<CashEventPlanner.GoalPlan> goals = goalRepository.findByUserIdOrderById(userId).stream().map(this::toPlan).toList();
        BigDecimal reserved = envelopeRepository.findByUserIdOrderById(userId).stream()
                .map(Envelope::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Context(today, wallets, balance, patterns, decisions, confirmed,
                cards, cardPlans, loans, loans.stream().map(this::toPlan).toList(),
                dailyEstimate, dailyAmount, cardEstimate, cardAmount, mainCard(cardPlans, today), goals, reserved,
                scheduled(transactions, wallets, today));
    }

    /**
     * Entries the bank itself scheduled (Open Finance LANCAMENTO_FUTURO, imported as PENDING): confirmed future
     * events with the bank's own date and value.
     */
    /** The daily sync runs at 7h30; 36 hours without one means at least one run failed for this person (B50). */
    public static final java.time.Duration BANK_DATA_STALE_AFTER = java.time.Duration.ofHours(36);

    static java.time.Instant bankDataAsOf(List<Wallet> wallets) {
        return wallets.stream()
                .filter(wallet -> wallet.getSource() == com.github.yildizmy.domain.enums.WalletSource.OPEN_FINANCE)
                .map(Wallet::getLastSyncedAt)
                .filter(java.util.Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
    }

    static boolean bankDataStale(java.time.Instant asOf, java.time.Instant now) {
        return asOf != null && asOf.plus(BANK_DATA_STALE_AFTER).isBefore(now);
    }

    static List<CashEvent> scheduled(List<Transaction> transactions, List<Wallet> wallets, LocalDate today) {
        Map<Long, Wallet> byId = wallets.stream().collect(Collectors.toMap(Wallet::getId, Function.identity()));
        List<CashEvent> events = new ArrayList<>();
        for (Transaction transaction : transactions) {
            if (transaction.getStatus() != Status.PENDING || transaction.getSource() != TransactionSource.OPEN_FINANCE) continue;
            LocalDate date = LocalDate.ofInstant(transaction.getCreatedAt(), ZONE);
            Wallet account = byId.get(transaction.getToWallet().getId());
            if (!date.isAfter(today) || account == null) continue;
            boolean income = transaction.getType().getId() == TYPE_DEPOSIT;
            events.add(new CashEvent(date, income ? transaction.getAmount() : transaction.getAmount().negate(),
                    transaction.getDescription(), income ? CashEvent.Kind.INCOME : CashEvent.Kind.RECURRING_EXPENSE,
                    SCHEDULED, CashEvent.Certainty.CONFIRMED,
                    account.getInstitutionName() == null ? account.getName() : account.getInstitutionName(),
                    "scheduled:" + transaction.getId()));
        }
        return events;
    }

    /**
     * The bank's scheduled entry replaces the estimate for the same bill: same counterparty, same direction,
     * within {@value #SAME_BILL_DAYS} days. Without this, a rent the bank already scheduled would count twice.
     */
    static List<CashEvent> withScheduled(List<CashEvent> planned, List<CashEvent> scheduled) {
        if (scheduled.isEmpty()) return planned;
        List<CashEvent> events = new ArrayList<>(scheduled);
        for (CashEvent event : planned) {
            boolean replaced = event.certainty() == CashEvent.Certainty.ESTIMATED
                    && scheduled.stream().anyMatch(bank -> bank.isInflow() == event.isInflow()
                    && RecurrenceDetector.counterpartyKey(bank.label()).equals(RecurrenceDetector.counterpartyKey(event.label()))
                    && Math.abs(java.time.temporal.ChronoUnit.DAYS.between(bank.date(), event.date())) <= SAME_BILL_DAYS);
            if (!replaced) events.add(event);
        }
        return events;
    }

    /** The user's value, or the estimate, when the answer is CONFIRMED; null otherwise. */
    private static BigDecimal applied(RecurrenceDecision decision, Optional<DailySpending.Estimate> estimate) {
        if (decision == null || decision.getStatus() != RecurrenceStatus.CONFIRMED) return null;
        return decision.getAmount() != null ? decision.getAmount() : estimate.map(DailySpending.Estimate::daily).orElse(null);
    }

    // ponytail: the everyday card estimate is charged to the card with the most single purchases in the
    // window. Split it per card when users with several active cards show up.
    private static CardPlan mainCard(List<CardPlan> cards, LocalDate today) {
        LocalDate from = today.minusDays(90);
        return cards.stream()
                .max(Comparator.comparing(card -> card.charges().stream()
                        .filter(charge -> charge.installments() == 1 && !charge.purchaseDate().isBefore(from))
                        .map(CardPlan.Charge::totalAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .orElse(null);
    }

    /**
     * Settled movements from the user's point of view. Transfers between the user's own wallets
     * are skipped: they move money, they don't create income or expense.
     */
    List<Movement> movements(long userId, List<Wallet> wallets) {
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        return movements(transactionRepository.findAllByUserIdSince(userId,
                today.minusMonths(HISTORY_MONTHS).atStartOfDay(ZONE).toInstant()), wallets);
    }

    static List<Movement> movements(List<Transaction> transactions, List<Wallet> wallets) {
        Set<Long> own = wallets.stream().map(Wallet::getId).collect(Collectors.toSet());
        Map<Long, Wallet> byId = wallets.stream().collect(Collectors.toMap(Wallet::getId, Function.identity()));
        List<Movement> movements = new ArrayList<>();
        for (Transaction transaction : transactions) {
            if (transaction.getStatus() != Status.SUCCESS) continue;
            Long from = transaction.getFromWallet().getId();
            Long to = transaction.getToWallet().getId();
            long typeId = transaction.getType().getId();
            LocalDate date = LocalDate.ofInstant(transaction.getCreatedAt(), ZONE);
            Direction direction;
            Wallet account;
            String counterparty;
            if (Objects.equals(from, to) && (typeId == TYPE_DEPOSIT || typeId == TYPE_WITHDRAWAL)) {
                direction = typeId == TYPE_DEPOSIT ? Direction.IN : Direction.OUT;
                account = byId.get(from);
                counterparty = transaction.getSource() == TransactionSource.OPEN_FINANCE
                        ? transaction.getDescription()
                        : (direction == Direction.IN ? "Depósito" : "Retirada");
            } else if (own.contains(from) && own.contains(to)) {
                continue;
            } else if (own.contains(from)) {
                direction = Direction.OUT;
                account = byId.get(from);
                counterparty = "Transferência enviada";
            } else if (own.contains(to)) {
                direction = Direction.IN;
                account = byId.get(to);
                counterparty = "Transferência recebida";
            } else {
                continue;
            }
            if (account == null) continue;
            movements.add(new Movement(transaction.getId(), date, transaction.getAmount(), direction, counterparty,
                    account.getName(), account.getInstitutionName()));
        }
        return movements;
    }

    private CardPlan toPlan(CreditCard card) {
        return new CardPlan(
                card.getId(),
                card.getName() + (card.getLastDigits() == null ? "" : " · final " + card.getLastDigits()),
                card.getInstitution(),
                card.getClosingDay(),
                card.getDueDay(),
                card.getCharges().stream()
                        .map(charge -> new CardPlan.Charge(
                                charge.getId(),
                                charge.getDescription(),
                                charge.getPurchaseDate(),
                                charge.getTotalAmount(),
                                charge.getInstallmentAmount(),
                                charge.getInstallments(),
                                YearMonth.from(charge.getFirstInvoice())))
                        .toList()
        );
    }

    private LoanPlan toPlan(Loan loan) {
        return new LoanPlan(
                loan.getId(),
                loan.getProduct(),
                loan.getInstitution(),
                loan.getOutstandingBalance(),
                loan.getInstallmentAmount(),
                loan.getInstallmentsTotal(),
                loan.getInstallmentsPaid(),
                loan.getNextDueDate(),
                loan.getDueDay()
        );
    }

    // --- mapping -----------------------------------------------------------------------------

    private FutureResponses.Committed committed(LocalDate until, List<CashEvent> outflows) {
        Map<String, List<CashEvent>> groups = outflows.stream()
                .collect(Collectors.groupingBy(CashEvent::category, LinkedHashMap::new, Collectors.toList()));
        List<FutureResponses.CommittedGroup> mapped = groups.entrySet().stream()
                .map(entry -> new FutureResponses.CommittedGroup(
                        entry.getKey(),
                        sumOut(entry.getValue()),
                        toEvents(entry.getValue())))
                .sorted(Comparator.comparing(FutureResponses.CommittedGroup::total).reversed())
                .toList();
        return new FutureResponses.Committed(
                until,
                sumOut(outflows),
                sumOut(outflows.stream().filter(event -> event.certainty() == CashEvent.Certainty.CONFIRMED).toList()),
                sumOut(outflows.stream().filter(event -> event.certainty() == CashEvent.Certainty.ESTIMATED).toList()),
                mapped
        );
    }

    private BigDecimal sumOut(List<CashEvent> events) {
        return events.stream().map(event -> event.amount().negate()).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private FutureResponses.Card toResponse(CardPlan plan, CreditCard card, LocalDate today) {
        YearMonth first = YearMonth.from(today);
        if (plan.dueDate(first).isBefore(today)) first = first.plusMonths(1);
        YearMonth open = plan.invoiceFor(today);
        List<FutureResponses.Invoice> invoices = new ArrayList<>();
        BigDecimal committedLimit = BigDecimal.ZERO;
        YearMonth lastBooked = plan.charges().stream()
                .map(charge -> charge.firstInvoice().plusMonths(charge.installments() - 1L))
                .max(Comparator.naturalOrder())
                .orElse(first);
        for (YearMonth invoice = first; !invoice.isAfter(lastBooked); invoice = invoice.plusMonths(1)) {
            BigDecimal total = plan.invoiceTotal(invoice);
            committedLimit = committedLimit.add(total);
            if (invoices.size() >= 6) continue;
            String status = invoice.isBefore(open) ? "CLOSED" : invoice.equals(open) ? "OPEN" : "FUTURE";
            invoices.add(new FutureResponses.Invoice(
                    invoice.toString(),
                    plan.closingDate(plan.dueDay() > plan.closingDay() ? invoice : invoice.minusMonths(1)),
                    plan.dueDate(invoice),
                    status,
                    total,
                    plan.invoiceLines(invoice).stream()
                            .map(line -> new FutureResponses.InvoiceLine(
                                    line.charge().description(),
                                    line.charge().purchaseDate(),
                                    line.installment(),
                                    line.charge().installments(),
                                    line.charge().amountFor(line.installment())))
                            .toList()
            ));
        }
        return new FutureResponses.Card(
                card.getId(),
                card.getName(),
                card.getInstitution(),
                card.getLastDigits(),
                card.getCreditLimit(),
                committedLimit,
                card.getClosingDay(),
                card.getDueDay(),
                invoices,
                card.getNextBillDueDate(),
                card.getNextBillTotal(),
                card.getNextBillMinimum()
        );
    }

    private FutureResponses.Projection toResponse(ProjectionEngine.Projection projection, int horizonDays,
                                                  OverdraftCost.Rate overdraftRate) {
        return new FutureResponses.Projection(
                horizonDays,
                projection.openingBalance(),
                projection.minBalance(),
                projection.minDate(),
                projection.endBalance(),
                projection.negativeDays(),
                projection.days().stream()
                        .map(day -> new FutureResponses.DayPoint(day.date(), day.balance(), day.inflow(), day.outflow()))
                        .toList(),
                projection.riskWindows().stream()
                        .map(window -> new FutureResponses.RiskWindow(
                                window.start(),
                                window.end(),
                                window.lowestBalance(),
                                window.lowestDate(),
                                window.untilHorizon(),
                                toEvents(window.causes()),
                                window.relief() == null ? null : toResponse(window.relief()),
                                window.overdraftCostCap(),
                                overdraft(OverdraftCost.estimate(window.overdraftCostCap(), window.lowestBalance(), overdraftRate))))
                        .toList(),
                toEvents(projection.events())
        );
    }

    private static FutureResponses.OverdraftEstimate overdraft(OverdraftCost.Estimate estimate) {
        OverdraftCost.Rate rate = estimate.rate();
        return new FutureResponses.OverdraftEstimate(estimate.interest(), estimate.iof(), estimate.total(),
                rate.monthlyPercent(), rate.source().name(), rate.institution(), rate.referenceDate());
    }

    /**
     * Maps events, folding the one-per-day everyday-spending events into a single line so lists stay
     * readable. The folded line keeps the total, and its reference says how many days it covers.
     */
    private List<FutureResponses.Event> toEvents(List<CashEvent> events) {
        List<CashEvent> daily = events.stream().filter(event -> event.kind() == CashEvent.Kind.DAILY_SPENDING).toList();
        List<FutureResponses.Event> mapped = new ArrayList<>(events.stream()
                .filter(event -> event.kind() != CashEvent.Kind.DAILY_SPENDING)
                .map(this::toResponse)
                .toList());
        if (!daily.isEmpty()) {
            CashEvent last = daily.get(daily.size() - 1);
            mapped.add(new FutureResponses.Event(
                    last.date(),
                    daily.stream().map(CashEvent::amount).reduce(BigDecimal.ZERO, BigDecimal::add),
                    last.label(),
                    last.kind().name(),
                    last.category(),
                    last.certainty().name(),
                    last.origin(),
                    DAILY_SPENDING_KEY + ":" + daily.size(),
                    LabelKeys.label(last.label()),
                    LabelKeys.origin(last.origin()),
                    LabelKeys.originDays(last.origin())));
            mapped.sort(Comparator.comparing(FutureResponses.Event::date));
        }
        return mapped;
    }

    private FutureResponses.Event toResponse(CashEvent event) {
        return new FutureResponses.Event(
                event.date(),
                event.amount(),
                event.label(),
                event.kind().name(),
                event.category(),
                event.certainty().name(),
                event.origin(),
                event.reference(),
                LabelKeys.label(event.label()),
                LabelKeys.origin(event.origin()),
                LabelKeys.originDays(event.origin())
        );
    }

    /**
     * Codes for the texts the engine writes itself, so the UI shows them in the viewer's language (the Portuguese
     * text stays in {@code label}/{@code origin} for the e-mail and for older clients). Counterparties and names the
     * user typed have no code: they are data, not interface text.
     */
    static final class LabelKeys {
        private static final Map<String, String> LABELS = Map.of(
                "Gastos do dia a dia", "DAILY_SPENDING",
                "Compras do dia a dia no cartão", "CARD_SPENDING",
                "Compra simulada", "SCENARIO_PURCHASE",
                "Guardar todo mês", "SCENARIO_SAVING",
                "Transferência enviada", "TRANSFER_SENT",
                "Transferência recebida", "TRANSFER_RECEIVED",
                "Depósito", "DEPOSIT",
                "Retirada", "WITHDRAWAL");
        private static final java.util.regex.Pattern AVERAGE = java.util.regex.Pattern.compile("Média dos últimos (\\d+) dias");

        private LabelKeys() {
        }

        static String label(String text) {
            return text == null ? null : LABELS.get(text);
        }

        static String origin(String text) {
            if (text == null) return null;
            if (text.equals("Meta")) return "GOAL";
            if (text.equals("Valor informado")) return "USER_VALUE";
            return AVERAGE.matcher(text).matches() ? "AVERAGE_DAYS" : null;
        }

        static Integer originDays(String text) {
            if (text == null) return null;
            var matcher = AVERAGE.matcher(text);
            return matcher.matches() ? Integer.valueOf(matcher.group(1)) : null;
        }
    }

    private FutureResponses.ScenarioSummary summary(ProjectionEngine.Projection projection) {
        LocalDate limit30 = projection.start().plusDays(COMMITTED_WINDOW_DAYS);
        BigDecimal min30 = projection.days().stream()
                .filter(day -> !day.date().isAfter(limit30))
                .map(ProjectionEngine.DayPoint::balance)
                .min(BigDecimal::compareTo)
                .orElse(projection.openingBalance());
        LocalDate firstNegative = projection.days().stream()
                .filter(day -> day.balance().signum() < 0)
                .map(ProjectionEngine.DayPoint::date)
                .findFirst()
                .orElse(null);
        return new FutureResponses.ScenarioSummary(
                min30,
                projection.minBalance(),
                projection.minDate(),
                firstNegative,
                projection.negativeDays(),
                projection.endBalance()
        );
    }

    private record Context(
            LocalDate today,
            List<Wallet> wallets,
            BigDecimal balance,
            List<RecurrencePattern> patterns,
            Map<String, RecurrenceDecision> decisions,
            List<ConfirmedRecurrence> confirmed,
            List<CreditCard> cards,
            List<CardPlan> cardPlans,
            List<Loan> loans,
            List<LoanPlan> loanPlans,
            Optional<DailySpending.Estimate> dailyEstimate,
            BigDecimal dailyAmount,
            Optional<DailySpending.Estimate> cardEstimate,
            BigDecimal cardAmount,
            CardPlan mainCard,
            List<CashEventPlanner.GoalPlan> goals,
            BigDecimal reserved,
            List<CashEvent> scheduled
    ) {

        /** Everything the user confirmed, everyday spending on the account and on the card included. */
        List<CashEvent> plan(LocalDate end) {
            List<CashEvent> events = new ArrayList<>(planFixed(end));
            events.addAll(CashEventPlanner.dailySpending(dailyAmount, today, end,
                    dailyEstimate.map(estimate -> "Média dos últimos " + estimate.days() + " dias").orElse("Valor informado")));
            events.addAll(CashEventPlanner.cardSpending(cardAmount, mainCard, today, end));
            return events;
        }

        /**
         * The base for the daily spending limit: everything fixed plus the card purchases the user confirmed,
         * which become an invoice before the next income. Only account everyday spending is left out, because
         * that is what the limit answers.
         */
        List<CashEvent> planForLimit(LocalDate end) {
            List<CashEvent> events = new ArrayList<>(planFixed(end));
            events.addAll(CashEventPlanner.cardSpending(cardAmount, mainCard, today, end));
            return events;
        }

        /** Bills, invoices, instalments and the user's goals. */
        List<CashEvent> planFixed(LocalDate end) {
            List<CashEvent> events = new ArrayList<>(withScheduled(
                    CashEventPlanner.plan(today, end, confirmed, cardPlans, loanPlans),
                    scheduled.stream().filter(event -> !event.date().isAfter(end)).toList()));
            events.addAll(CashEventPlanner.goals(goals, today, end));
            return events;
        }
    }
}
