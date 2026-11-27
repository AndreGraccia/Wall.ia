package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEventPlanner.ConfirmedRecurrence;
import com.github.yildizmy.service.future.RecurrenceDetector.Category;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Plano do mês (proposta de André Graccia, ADR 0021): the confirmed monthly income split in slices the person edits.
 * <p>
 * Essentials (kind FIXED: fixed bills plus everyday essentials) and leisure are measured against what happened. Any other slice becomes a monthly commitment only when the
 * person marks it; a marked slice leaves the balance the day the main income arrives ("pague-se primeiro"), so the
 * daily limit already discounts it and there is no second number.
 */
public final class MonthPlanCalculator {

    public static final String ORIGIN = "Plano do mês";
    public static final int MAX_SLICES = 12;
    public static final int MAX_LABEL = 40;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final Set<Category> INCOME = Set.of(Category.SALARY, Category.OTHER_INCOME);
    private static final Set<Category> FIXED = Set.of(Category.RENT, Category.BILL, Category.SUBSCRIPTION);

    private MonthPlanCalculator() {
    }

    /**
     * FIXED ("Essenciais"; the stored name stays) is a thermometer and LEISURE a ceiling: both are measured and never committed. FUTURE holds the goals.
     * Every kind but CUSTOM appears at most once.
     */
    public enum Kind {
        FIXED, LEISURE, INVESTMENT, FUTURE, DEVELOPMENT, EMERGENCY, CUSTOM;

        public boolean committable() {
            return this != FIXED && this != LEISURE;
        }
    }

    /** @param commitment the person marked it to leave the balance every month ("virar compromisso") */
    public record Slice(Kind kind, String label, BigDecimal percent, boolean commitment) {
    }

    private static Slice slice(Kind kind, String label, String percent) {
        return new Slice(kind, label, new BigDecimal(percent), false);
    }

    /** Equilibrado 35/20/15 (proposed by André Graccia, ADR 0021). Nothing is committed until the person marks it. */
    public static final List<Slice> PRESET_BALANCED = List.of(
            slice(Kind.FIXED, "Essenciais", "35.00"),
            slice(Kind.LEISURE, "Lazer", "20.00"),
            slice(Kind.INVESTMENT, "Investimento", "15.00"),
            slice(Kind.FUTURE, "Futuro", "7.50"),
            slice(Kind.DEVELOPMENT, "Desenvolvimento pessoal e estudo", "10.00"),
            slice(Kind.EMERGENCY, "Reserva de emergência", "12.50"));

    /** 50/30/20: needs, wants, saving and debts. */
    public static final List<Slice> PRESET_503020 = List.of(
            slice(Kind.FIXED, "Necessidades", "50.00"),
            slice(Kind.LEISURE, "Desejos", "30.00"),
            slice(Kind.FUTURE, "Poupança e dívidas", "20.00"));

    /**
     * Null when the slices can be saved; otherwise the error code. The sum is not checked here: a draft that does not
     * add up to 100 can be saved and is shown as incomplete ({@link #complete}); only a complete plan can be active.
     */
    public static String validate(List<Slice> slices) {
        if (slices == null || slices.isEmpty()) return "MONTH_PLAN_EMPTY";
        if (slices.size() > MAX_SLICES) return "MONTH_PLAN_TOO_MANY_SLICES";
        Set<Kind> seen = EnumSet.noneOf(Kind.class);
        for (Slice slice : slices) {
            if (slice == null || slice.kind() == null) return "MONTH_PLAN_INVALID_SLICE";
            if (slice.label() == null || slice.label().isBlank() || slice.label().length() > MAX_LABEL) {
                return "MONTH_PLAN_INVALID_LABEL";
            }
            BigDecimal percent = slice.percent();
            if (percent == null || percent.stripTrailingZeros().scale() > 2
                    || percent.signum() < 0 || percent.compareTo(HUNDRED) > 0) {
                return "MONTH_PLAN_INVALID_PERCENT";
            }
            if (slice.commitment() && !slice.kind().committable()) return "MONTH_PLAN_SLICE_NOT_COMMITTABLE";
            if (slice.kind() != Kind.CUSTOM && !seen.add(slice.kind())) return "MONTH_PLAN_DUPLICATE_SLICE";
        }
        return null;
    }

    public static BigDecimal total(List<Slice> slices) {
        return slices.stream().map(Slice::percent).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Adds up to exactly 100%: the only state that can be activated. */
    public static boolean complete(List<Slice> slices) {
        return total(slices).compareTo(HUNDRED) == 0;
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
        List<ConfirmedRecurrence> sources = incomes(confirmed).stream()
                .sorted(Comparator.comparing((ConfirmedRecurrence item) -> item.category() == Category.SALARY).reversed()
                        .thenComparing(item -> item.pattern().typicalAmount(), Comparator.reverseOrder()))
                .toList();
        if (sources.isEmpty()) return Optional.empty();
        BigDecimal monthly = sources.stream().map(item -> item.pattern().typicalAmount()).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Optional.of(new Income(monthly, sources.get(0), sources));
    }

    /** The confirmed recurrences that are income (SALARY or OTHER_INCOME, money coming in). */
    public static List<ConfirmedRecurrence> incomes(List<ConfirmedRecurrence> confirmed) {
        return confirmed.stream()
                .filter(item -> item.pattern().direction() == Direction.IN && INCOME.contains(item.category()))
                .toList();
    }

    /**
     * Base x percent per slice, in cents, HALF_EVEN. When the plan is complete, the cents lost or gained by rounding go
     * to the largest slice (the first one on a tie), so the slices add up to the base exactly. Deterministic.
     */
    public static List<BigDecimal> amounts(BigDecimal base, List<Slice> slices) {
        List<BigDecimal> amounts = new ArrayList<>(slices.stream()
                .map(slice -> base.multiply(slice.percent()).divide(HUNDRED, 2, RoundingMode.HALF_EVEN))
                .toList());
        if (!slices.isEmpty() && complete(slices)) {
            BigDecimal residual = base.setScale(2, RoundingMode.HALF_EVEN)
                    .subtract(amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
            int largest = 0;
            for (int i = 1; i < slices.size(); i++) {
                if (slices.get(i).percent().compareTo(slices.get(largest).percent()) > 0) largest = i;
            }
            amounts.set(largest, amounts.get(largest).add(residual));
        }
        return amounts;
    }

    /** @param position index of the slice in the plan */
    public record Commitment(int position, Kind kind, String label, BigDecimal amount) {
    }

    /**
     * What each marked slice takes from the balance every month. Goals already leave the balance on their own day, so
     * they live inside a committed FUTURE slice: the slice only commits what the goals do not cover.
     */
    public static List<Commitment> commitments(BigDecimal base, List<Slice> slices, BigDecimal goalsMonthly) {
        List<BigDecimal> amounts = amounts(base, slices);
        List<Commitment> commitments = new ArrayList<>();
        for (int i = 0; i < slices.size(); i++) {
            Slice slice = slices.get(i);
            if (!slice.commitment()) continue;
            BigDecimal amount = amounts.get(i);
            if (slice.kind() == Kind.FUTURE) amount = amount.subtract(goalsMonthly).max(BigDecimal.ZERO.setScale(2));
            commitments.add(new Commitment(i, slice.kind(), slice.label(), amount));
        }
        return commitments;
    }

    public static BigDecimal sum(List<Commitment> commitments) {
        return commitments.stream().map(Commitment::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** One CONFIRMED outflow per commitment on each future arrival of the main income (same dates as it). */
    public static List<CashEvent> events(List<Commitment> commitments, ConfirmedRecurrence mainIncome,
                                         LocalDate today, LocalDate end) {
        List<CashEvent> events = new ArrayList<>();
        if (commitments.isEmpty()) return events;
        for (CashEvent income : CashEventPlanner.fromRecurrence(mainIncome, today, end)) {
            for (Commitment commitment : commitments) {
                if (commitment.amount().signum() <= 0) continue;
                events.add(new CashEvent(income.date(), commitment.amount().negate(), ORIGIN + ": " + commitment.label(),
                        CashEvent.Kind.PLAN, "PLAN_" + commitment.kind().name(), CashEvent.Certainty.CONFIRMED, ORIGIN,
                        "plan:" + commitment.position()));
            }
        }
        return events;
    }

    /** Next day the main income (and so the plan) is expected, within two months; empty when none is. */
    public static Optional<LocalDate> nextDate(ConfirmedRecurrence mainIncome, LocalDate today) {
        return CashEventPlanner.fromRecurrence(mainIncome, today, today.plusMonths(2)).stream()
                .map(CashEvent::date).filter(date -> date.isAfter(today)).findFirst();
    }

    /**
     * The fixed bills alone, per month; the essentials slice adds the month's everyday essentials on top.
     *
     * @param recurring confirmed rent, bills and subscriptions (estimated values)
     * @param loans     instalments the bank reports
     */
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

    /** How much of {@code slice} {@code used} is, in percent with one decimal; null when the slice is zero. */
    public static BigDecimal usedPercent(BigDecimal used, BigDecimal slice) {
        if (slice == null || slice.signum() <= 0) return null;
        return used.multiply(HUNDRED).divide(slice, 1, RoundingMode.HALF_UP);
    }
}
