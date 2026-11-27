package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.MonthPlan;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.dto.response.PlanResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.MonthPlanRepository;
import com.github.yildizmy.service.future.CashEvent;
import com.github.yildizmy.service.future.Categories;
import com.github.yildizmy.service.future.MonthFlow;
import com.github.yildizmy.service.future.MonthPlanCalculator;
import com.github.yildizmy.service.future.MonthPlanCalculator.Kind;
import com.github.yildizmy.service.future.MonthlyProjection;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import com.github.yildizmy.service.future.RecurrenceDetector.RecurrencePattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Plano do mês, Entradas e saídas and Projeção mensal (proposta de André Graccia, ADR 0021). Reads the same context
 * as Futuro, so every number here agrees with the projection and the daily limit. Java calculates; nothing is guessed.
 */
@Service
@RequiredArgsConstructor
public class MonthPlanService {

    static final Set<Integer> PROJECTION_MONTHS = Set.of(3, 6, 12);
    /** Entradas e saídas reads the current month and the 12 before it: the history Futuro already loads. */
    static final int CASH_FLOW_MONTHS_BACK = 12;
    private static final String CONFIRMED = CashEvent.Certainty.CONFIRMED.name();
    private static final String ESTIMATED = CashEvent.Certainty.ESTIMATED.name();

    private final FutureService futureService;
    private final MonthPlanRepository repository;
    private final UserService userService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PlanResponses.MonthPlan view(long userId) {
        FutureService.Context context = futureService.context(userId);
        return view(context, context.monthPlan());
    }

    /**
     * Saves the slices. A draft may add up to something other than 100% and is returned as INCOMPLETE; an active plan
     * may not (422 MONTH_PLAN_INCOMPLETE): its marked slices enter the projection as soon as this returns.
     */
    @Transactional
    public PlanResponses.MonthPlan save(long userId, List<MonthPlanCalculator.Slice> slices) {
        String invalid = MonthPlanCalculator.validate(slices);
        if (invalid != null) throw new WalletRuleException(invalid);
        userService.lockForUpdate(userId);
        FutureService.Context context = futureService.context(userId);
        MonthPlan plan = context.monthPlan() == null ? newPlan(userId) : context.monthPlan();
        if (plan.isActive() && !MonthPlanCalculator.complete(slices)) throw new WalletRuleException("MONTH_PLAN_INCOMPLETE");
        plan.getSlices().clear();
        for (MonthPlanCalculator.Slice slice : slices) {
            MonthPlan.Slice row = new MonthPlan.Slice();
            row.setKind(slice.kind().name());
            row.setLabel(slice.label());
            row.setPercent(slice.percent());
            row.setCommitment(slice.commitment());
            plan.getSlices().add(row);
        }
        plan.setUpdatedAt(clock.instant());
        repository.save(plan);
        return view(context, plan);
    }

    /**
     * The confirmation: turning the plan on needs a saved plan (MONTH_PLAN_EMPTY), adding up to 100%
     * (MONTH_PLAN_INCOMPLETE) and a confirmed income (MONTH_PLAN_NEEDS_INCOME), all 422. Off always works.
     */
    @Transactional
    public PlanResponses.MonthPlan setActive(long userId, boolean active) {
        userService.lockForUpdate(userId);
        FutureService.Context context = futureService.context(userId);
        MonthPlan plan = context.monthPlan();
        if (active) {
            if (plan == null || plan.getSlices().isEmpty()) throw new WalletRuleException("MONTH_PLAN_EMPTY");
            if (!MonthPlanCalculator.complete(FutureService.slices(plan))) throw new WalletRuleException("MONTH_PLAN_INCOMPLETE");
            if (MonthPlanCalculator.income(context.confirmed()).isEmpty()) throw new WalletRuleException("MONTH_PLAN_NEEDS_INCOME");
        }
        if (plan == null) return view(context, null);
        if (plan.isActive() != active) {
            plan.setActive(active);
            plan.setActivatedAt(active ? clock.instant() : null);
            plan.setUpdatedAt(clock.instant());
            repository.save(plan);
        }
        return view(context, plan);
    }

    /** 3, 6 or 12 months, current one included, from the same events as the daily projection. */
    @Transactional(readOnly = true)
    public PlanResponses.Projection projection(long userId, int months) {
        if (!PROJECTION_MONTHS.contains(months)) throw new WalletRuleException("INVALID_HORIZON");
        FutureService.Context context = futureService.context(userId);
        LocalDate end = MonthlyProjection.end(context.today(), months);
        return new PlanResponses.Projection(months, context.today(), end, context.balance(),
                !context.planCommitments().isEmpty(),
                MonthlyProjection.summarize(context.today(), context.balance(), context.plan(end), months));
    }

    /** Entradas e saídas of {@code month} (null = current), with the three totals of the Início screen. */
    @Transactional(readOnly = true)
    public PlanResponses.CashFlow cashFlow(long userId, YearMonth month) {
        FutureService.Context context = futureService.context(userId);
        YearMonth current = YearMonth.from(context.today());
        YearMonth chosen = month == null ? current : month;
        if (chosen.isAfter(current) || chosen.isBefore(current.minusMonths(CASH_FLOW_MONTHS_BACK))) {
            throw new WalletRuleException("INVALID_MONTH");
        }
        MonthFlow.Result flow = monthFlow(context, chosen);
        boolean isCurrent = chosen.equals(current);
        BigDecimal investment = isCurrent
                ? context.planCommitments().stream().filter(item -> item.kind() == Kind.INVESTMENT)
                .map(MonthPlanCalculator.Commitment::amount).reduce(BigDecimal.ZERO, BigDecimal::add)
                : BigDecimal.ZERO;
        String investmentOrigin = investment.signum() > 0 ? MonthPlanCalculator.ORIGIN : null;
        return new PlanResponses.CashFlow(chosen.toString(), isCurrent, flow.income(), flow.spending(),
                new PlanResponses.Home(flow.income().total(), flow.spending().total(), flow.leisure(), investment,
                        investmentOrigin, flow.leisure().add(investment)),
                FutureService.bankData(context.wallets(), clock.instant()));
    }

    // --- internals ---------------------------------------------------------------------------

    /**
     * The month's settled movements, without transfers between the person's own accounts:
     * {@link FutureService#movements(List, List)} drops both the local ones and the imported pairs.
     */
    static MonthFlow.Result monthFlow(FutureService.Context context, YearMonth month) {
        List<Transaction> inMonth = context.transactions().stream()
                .filter(transaction -> transaction.getStatus() == Status.SUCCESS)
                .filter(transaction -> YearMonth.from(transaction.getCreatedAt().atZone(FutureService.ZONE)).equals(month))
                .toList();
        Map<Long, String> paymentTypes = new HashMap<>();
        inMonth.forEach(transaction -> paymentTypes.put(transaction.getId(), transaction.getPaymentType()));
        List<MonthFlow.Line> lines = new ArrayList<>();
        for (Movement movement : FutureService.movements(inMonth, context.wallets())) {
            lines.add(new MonthFlow.Line(movement, paymentTypes.get(movement.id())));
        }
        Map<String, String> confirmed = context.confirmed().stream()
                .collect(Collectors.toMap(item -> item.pattern().key(), item -> item.category().name(), (a, b) -> a));
        Set<String> pending = context.patterns().stream()
                .map(RecurrencePattern::key)
                .filter(key -> !context.decisions().containsKey(key))
                .collect(Collectors.toSet());
        Set<String> counted = context.countedRecurrences().stream()
                .filter(item -> Categories.ESSENTIALS_SLICE.contains(item.category().name()))
                .map(item -> item.pattern().key())
                .collect(Collectors.toSet());
        return MonthFlow.of(lines, confirmed, pending, counted, context.cardPlans(), context.categories());
    }

    private PlanResponses.MonthPlan view(FutureService.Context context, MonthPlan plan) {
        List<MonthPlanCalculator.Slice> slices = FutureService.slices(plan);
        boolean saved = plan != null && !slices.isEmpty();
        boolean active = plan != null && plan.isActive();
        boolean complete = saved && MonthPlanCalculator.complete(slices);
        BigDecimal total = MonthPlanCalculator.total(slices);
        Optional<MonthPlanCalculator.Income> income = MonthPlanCalculator.income(context.confirmed());
        BigDecimal goals = context.goalsMonthly();

        List<String> warnings = new ArrayList<>();
        if (saved && !complete) warnings.add("INCOMPLETE");
        if (income.isEmpty()) warnings.add(active ? "ACTIVE_WITHOUT_INCOME" : "NEEDS_CONFIRMED_INCOME");
        String status = active ? "ACTIVE" : income.isEmpty() ? "NEEDS_CONFIRMED_INCOME" : !saved ? "EMPTY"
                : !complete ? "INCOMPLETE" : "DRAFT";
        Instant activatedAt = plan == null ? null : plan.getActivatedAt();

        if (income.isEmpty()) {
            List<PlanResponses.Slice> rows = new ArrayList<>();
            for (int i = 0; i < slices.size(); i++) {
                MonthPlanCalculator.Slice slice = slices.get(i);
                rows.add(new PlanResponses.Slice(i, slice.kind().name(), slice.label(), slice.percent(), slice.commitment(),
                        role(slice), null, null, null, null, null, null, null));
            }
            return new PlanResponses.MonthPlan(status, warnings, saved, complete, total, active, activatedAt, null, rows,
                    BigDecimal.ZERO, goals, null, null);
        }

        BigDecimal base = income.get().monthly();
        MonthPlanCalculator.FixedUsed fixed = MonthPlanCalculator.fixedUsed(context.countedRecurrences(), context.loanPlans());
        MonthFlow.Result flow = monthFlow(context, YearMonth.from(context.today()));
        BigDecimal essentials = fixed.total().add(flow.essentials());
        BigDecimal leisure = flow.leisure();
        List<BigDecimal> amounts = MonthPlanCalculator.amounts(base, slices);
        Map<Integer, BigDecimal> committed = MonthPlanCalculator.commitments(base, slices, goals).stream()
                .collect(Collectors.toMap(MonthPlanCalculator.Commitment::position, MonthPlanCalculator.Commitment::amount));
        List<PlanResponses.Slice> rows = new ArrayList<>();
        for (int i = 0; i < slices.size(); i++) {
            MonthPlanCalculator.Slice slice = slices.get(i);
            BigDecimal amount = amounts.get(i);
            rows.add(switch (slice.kind()) {
                case FIXED -> new PlanResponses.Slice(i, slice.kind().name(), slice.label(), slice.percent(), false,
                        role(slice), amount, essentials, MonthPlanCalculator.usedPercent(essentials, amount),
                        amount.subtract(essentials), null, fixed.recurring().signum() > 0 ? ESTIMATED : CONFIRMED,
                        "Recorrências confirmadas, parcelas de empréstimo e essenciais do extrato do mês");
                case LEISURE -> new PlanResponses.Slice(i, slice.kind().name(), slice.label(), slice.percent(), false,
                        role(slice), amount, leisure, MonthPlanCalculator.usedPercent(leisure, amount),
                        amount.subtract(leisure), null, CONFIRMED, "Gastos de lazer do extrato do mês, pela sua escolha ou pelo nome");
                default -> new PlanResponses.Slice(i, slice.kind().name(), slice.label(), slice.percent(),
                        slice.commitment(), role(slice), amount, null, null, null, committed.get(i),
                        slice.commitment() ? CONFIRMED : null, slice.commitment() ? MonthPlanCalculator.ORIGIN : null);
            });
        }
        var main = income.get().main();
        PlanResponses.Income incomeResponse = new PlanResponses.Income(base, main.pattern().typicalDay(),
                MonthPlanCalculator.nextDate(main, context.today()).orElse(null), ESTIMATED,
                "Recorrências de entrada confirmadas",
                income.get().sources().stream()
                        .map(item -> new PlanResponses.IncomeSource(item.pattern().key(), item.pattern().counterparty(),
                                item.category().name(), item.pattern().typicalAmount(), item.pattern().typicalDay()))
                        .toList());
        BigDecimal monthly = active ? committed.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add) : BigDecimal.ZERO;
        return new PlanResponses.MonthPlan(status, warnings, saved, complete, total, active, activatedAt, incomeResponse,
                rows, monthly, goals,
                new PlanResponses.FixedDetail(fixed.recurring(), fixed.loans(), flow.essentials()), flow.unclassified());
    }

    private static String role(MonthPlanCalculator.Slice slice) {
        return switch (slice.kind()) {
            case FIXED -> "THERMOMETER";
            case LEISURE -> "CEILING";
            default -> slice.commitment() ? "COMMITMENT" : "RESERVED";
        };
    }

    private MonthPlan newPlan(long userId) {
        MonthPlan plan = new MonthPlan();
        plan.setUser(userService.getReferenceById(userId));
        return plan;
    }
}
