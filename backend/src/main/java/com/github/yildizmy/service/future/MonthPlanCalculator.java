package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEventPlanner.ConfirmedRecurrence;
import com.github.yildizmy.service.future.RecurrenceDetector.Category;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Plano do mês (proposta de André Graccia, ADR 0021): the confirmed monthly income split in six slices.
 * <p>
 * Fixed and leisure are measured against what happened; investment, future, personal development and emergency
 * reserve become monthly commitments that leave the balance the day the main income arrives ("pague-se primeiro").
 * That is why the daily limit already discounts the plan: there is no second number.
 */
public final class MonthPlanCalculator {

    public static final String ORIGIN = "Plano do mês";
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final Set<Category> INCOME = Set.of(Category.SALARY, Category.OTHER_INCOME);
    private static final Set<Category> FIXED = Set.of(Category.RENT, Category.BILL, Category.SUBSCRIPTION);

    private MonthPlanCalculator() {
    }

    public enum Slice {
        FIXED(false, "Fixo"),
        LEISURE(false, "Lazer"),
        INVESTMENT(true, "Investimento"),
        FUTURE(true, "Futuro"),
        DEVELOPMENT(true, "Desenvolvimento pessoal e estudo"),
        EMERGENCY(true, "Reserva de emergência");

        private final boolean commitment;
        private final String label;

        Slice(boolean commitment, String label) {
            this.commitment = commitment;
            this.label = label;
        }

        /** True when the slice leaves the balance in the projection; fixed and leisure are only measured. */
        public boolean commitment() {
            return commitment;
        }

        /** The label of the event in the projection, e.g. "Plano do mês: Investimento". */
        public String eventLabel() {
            return ORIGIN + ": " + label;
        }
    }

    /** Percent of the base per slice, two decimals at most (7.5 = 7,5%). */
    public record Split(BigDecimal fixed, BigDecimal leisure, BigDecimal investment, BigDecimal future,
                        BigDecimal development, BigDecimal emergency) {

        public BigDecimal percent(Slice slice) {
            return switch (slice) {
                case FIXED -> fixed;
                case LEISURE -> leisure;
                case INVESTMENT -> investment;
                case FUTURE -> future;
                case DEVELOPMENT -> development;
                case EMERGENCY -> emergency;
            };
        }
    }

    public static final Split SUGGESTED = new Split(new BigDecimal("35.00"), new BigDecimal("20.00"),
            new BigDecimal("15.00"), new BigDecimal("7.50"), new BigDecimal("10.00"), new BigDecimal("12.50"));

    /** Null when the split is valid; otherwise the error code. */
    public static String validate(Split split) {
        BigDecimal total = BigDecimal.ZERO;
        for (Slice slice : Slice.values()) {
            BigDecimal percent = split.percent(slice);
            if (percent == null || percent.stripTrailingZeros().scale() > 2
                    || percent.signum() < 0 || percent.compareTo(HUNDRED) > 0) {
                return "MONTH_PLAN_INVALID_PERCENT";
            }
            total = total.add(percent);
        }
        return total.compareTo(HUNDRED) == 0 ? null : "MONTH_PLAN_SUM_NOT_100";
    }

    /**
     * @param monthly sum of the confirmed incomes; the detector only finds monthly patterns, so each typical value
     *                already is a month
     * @param main    the income whose day the commitments follow: the largest salary, else the largest income
     */
    public record Income(BigDecimal monthly, ConfirmedRecurrence main, List<ConfirmedRecurrence> sources) {
    }

    /** Empty when nothing was confirmed as income: the plan asks for it instead of guessing. */
    public static Optional<Income> income(List<ConfirmedRecurrence> confirmed) {
        List<ConfirmedRecurrence> sources = confirmed.stream()
                .filter(item -> item.pattern().direction() == Direction.IN && INCOME.contains(item.category()))
                .sorted(Comparator.comparing((ConfirmedRecurrence item) -> item.category() == Category.SALARY).reversed()
                        .thenComparing(item -> item.pattern().typicalAmount(), Comparator.reverseOrder()))
                .toList();
        if (sources.isEmpty()) return Optional.empty();
        BigDecimal monthly = sources.stream().map(item -> item.pattern().typicalAmount()).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Optional.of(new Income(monthly, sources.get(0), sources));
    }

    public static BigDecimal amount(BigDecimal base, BigDecimal percent) {
        return base.multiply(percent).divide(HUNDRED, 2, RoundingMode.HALF_EVEN);
    }

    /**
     * What each committed slice takes from the balance every month. Goals already leave the balance on their own
     * day, so they live inside the Future slice: the slice only commits what the goals do not cover.
     */
    public static Map<Slice, BigDecimal> commitments(BigDecimal base, Split split, BigDecimal goalsMonthly) {
        Map<Slice, BigDecimal> commitments = new EnumMap<>(Slice.class);
        for (Slice slice : Slice.values()) {
            if (!slice.commitment()) continue;
            BigDecimal amount = amount(base, split.percent(slice));
            if (slice == Slice.FUTURE) amount = amount.subtract(goalsMonthly).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_EVEN);
            commitments.put(slice, amount);
        }
        return commitments;
    }

    /** One CONFIRMED outflow per committed slice on each future arrival of the main income (same dates as it). */
    public static List<CashEvent> events(Map<Slice, BigDecimal> commitments, ConfirmedRecurrence mainIncome,
                                         LocalDate today, LocalDate end) {
        List<CashEvent> events = new ArrayList<>();
        for (CashEvent income : CashEventPlanner.fromRecurrence(mainIncome, today, end)) {
            commitments.forEach((slice, amount) -> {
                if (amount.signum() <= 0) return;
                events.add(new CashEvent(income.date(), amount.negate(), slice.eventLabel(), CashEvent.Kind.PLAN,
                        "PLAN_" + slice.name(), CashEvent.Certainty.CONFIRMED, ORIGIN, "plan:" + slice.name()));
            });
        }
        return events;
    }

    /** @param recurring confirmed rent, bills and subscriptions (estimated values); @param loans instalments the bank reports */
    public record FixedUsed(BigDecimal recurring, BigDecimal loans, BigDecimal total) {
    }

    public static FixedUsed fixedUsed(List<ConfirmedRecurrence> confirmed, List<LoanPlan> loans) {
        BigDecimal recurring = confirmed.stream()
                .filter(item -> item.pattern().direction() == Direction.OUT && FIXED.contains(item.category()))
                .map(item -> item.pattern().typicalAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal instalments = loans.stream()
                .filter(loan -> loan.remainingInstallments() > 0 && loan.installmentAmount() != null)
                .map(LoanPlan::installmentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new FixedUsed(recurring, instalments, recurring.add(instalments));
    }

    /** How much of the slice is used, in percent with one decimal; null when the slice is zero. */
    public static BigDecimal usedPercent(BigDecimal used, BigDecimal slice) {
        if (slice == null || slice.signum() <= 0) return null;
        return used.multiply(HUNDRED).divide(slice, 1, RoundingMode.HALF_UP);
    }
}
