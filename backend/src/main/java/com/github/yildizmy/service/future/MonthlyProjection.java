package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Projeção mensal (proposta de André Graccia, ADR 0021): the daily projection's events added up per month, for 3, 6
 * or 12 months. Nothing new is estimated here; a month is only as certain as the events it sums.
 */
public final class MonthlyProjection {

    private MonthlyProjection() {
    }

    /**
     * @param partial   the current month: only the days from today on (the balance already holds the rest)
     * @param plan      the month plan's commitments, apart from the other outflows
     * @param net       inflows minus outflows minus plan
     * @param endBalance projected balance on the month's last day
     */
    public record Month(YearMonth month, boolean partial, BigDecimal inflowConfirmed, BigDecimal inflowEstimated,
                        BigDecimal outflowConfirmed, BigDecimal outflowEstimated, BigDecimal plan, BigDecimal net,
                        BigDecimal endBalance) {
    }

    /** Last day the summary covers: the end of the {@code months}-th month, counting the current one. */
    public static LocalDate end(LocalDate today, int months) {
        return YearMonth.from(today).plusMonths(months - 1L).atEndOfMonth();
    }

    public static List<Month> summarize(LocalDate today, BigDecimal balance, List<CashEvent> events, int months) {
        LocalDate end = end(today, months);
        ProjectionEngine.Projection projection = ProjectionEngine.project(today, balance, events,
                (int) ChronoUnit.DAYS.between(today, end));
        Map<LocalDate, BigDecimal> balances = projection.days().stream()
                .collect(Collectors.toMap(ProjectionEngine.DayPoint::date, ProjectionEngine.DayPoint::balance));
        Map<YearMonth, List<CashEvent>> byMonth = events.stream()
                .filter(event -> !event.date().isBefore(today) && !event.date().isAfter(end))
                .collect(Collectors.groupingBy(event -> YearMonth.from(event.date())));

        List<Month> result = new ArrayList<>();
        for (int i = 0; i < months; i++) {
            YearMonth month = YearMonth.from(today).plusMonths(i);
            List<CashEvent> items = byMonth.getOrDefault(month, List.of());
            List<CashEvent> plan = items.stream().filter(event -> event.kind() == CashEvent.Kind.PLAN).toList();
            List<CashEvent> rest = items.stream().filter(event -> event.kind() != CashEvent.Kind.PLAN).toList();
            BigDecimal inConfirmed = sum(rest, true, CashEvent.Certainty.CONFIRMED);
            BigDecimal inEstimated = sum(rest, true, CashEvent.Certainty.ESTIMATED);
            BigDecimal outConfirmed = sum(rest, false, CashEvent.Certainty.CONFIRMED);
            BigDecimal outEstimated = sum(rest, false, CashEvent.Certainty.ESTIMATED);
            BigDecimal committed = plan.stream().map(event -> event.amount().negate()).reduce(BigDecimal.ZERO, BigDecimal::add);
            result.add(new Month(month, i == 0 && today.getDayOfMonth() > 1, inConfirmed, inEstimated, outConfirmed,
                    outEstimated, committed,
                    inConfirmed.add(inEstimated).subtract(outConfirmed).subtract(outEstimated).subtract(committed),
                    balances.get(month.atEndOfMonth())));
        }
        return result;
    }

    private static BigDecimal sum(List<CashEvent> events, boolean inflow, CashEvent.Certainty certainty) {
        return events.stream()
                .filter(event -> event.isInflow() == inflow && event.certainty() == certainty)
                .map(event -> inflow ? event.amount() : event.amount().negate())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
