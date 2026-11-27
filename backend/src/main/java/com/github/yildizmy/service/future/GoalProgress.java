package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * Where a goal with a target stands (B56, ADR 0025). Pure arithmetic over the person's own numbers: what is saved is
 * what they said, and the contribution days are the ones the projection already uses.
 */
public record GoalProgress(
        Status status,
        BigDecimal remaining,
        BigDecimal savedPercent,
        BigDecimal requiredMonthly,
        Integer contributionsUntilDate,
        LocalDate projectedDate
) {

    /** A target date, or a forecast, further than this is not a plan. */
    public static final int MAX_YEARS = 50;

    public enum Status {
        /** What is saved already covers the target. */
        REACHED,
        /** There is a target and no date: only the forecast at the current pace. */
        NO_DATE,
        /** No contribution day left up to the date (or the date passed): no monthly amount gets there. */
        DATE_TOO_SOON,
        ON_TRACK,
        LATE
    }

    /**
     * @param targetDate may be null
     * @param saved      may be null, which counts as nothing saved
     */
    public static GoalProgress of(CashEventPlanner.GoalPlan goal, BigDecimal target, LocalDate targetDate,
                                  BigDecimal saved, LocalDate today) {
        BigDecimal kept = saved == null ? BigDecimal.ZERO : saved;
        BigDecimal remaining = target.subtract(kept).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_EVEN);
        // Rounded down: 99,99% saved is not 100%.
        BigDecimal percent = kept.multiply(BigDecimal.valueOf(100)).divide(target, 1, RoundingMode.DOWN)
                .min(new BigDecimal("100.0"));
        if (remaining.signum() == 0) return new GoalProgress(Status.REACHED, remaining, percent, null, null, null);

        LocalDate projected = nthContribution(goal, remaining.divide(goal.monthlyAmount(), 0, RoundingMode.CEILING), today);
        if (targetDate == null) return new GoalProgress(Status.NO_DATE, remaining, percent, null, null, projected);

        int count = CashEventPlanner.goals(List.of(goal), today, targetDate).size();
        if (count == 0) return new GoalProgress(Status.DATE_TOO_SOON, remaining, percent, null, 0, projected);
        // Rounded up to the cent: rounded down, the last contribution would leave the target short.
        BigDecimal required = remaining.divide(BigDecimal.valueOf(count), 2, RoundingMode.CEILING);
        Status status = projected != null && !projected.isAfter(targetDate) ? Status.ON_TRACK : Status.LATE;
        return new GoalProgress(status, remaining, percent, required, count, projected);
    }

    /** Day of the n-th contribution after today; null beyond {@value #MAX_YEARS} years. */
    private static LocalDate nthContribution(CashEventPlanner.GoalPlan goal, BigDecimal n, LocalDate today) {
        if (n.compareTo(BigDecimal.valueOf(MAX_YEARS * 12L)) > 0) return null;
        YearMonth first = YearMonth.from(today);
        if (!day(first, goal.dayOfMonth()).isAfter(today)) first = first.plusMonths(1);
        return day(first.plusMonths(n.longValueExact() - 1), goal.dayOfMonth());
    }

    private static LocalDate day(YearMonth month, int dayOfMonth) {
        return month.atDay(Math.min(dayOfMonth, month.lengthOfMonth()));
    }
}
