package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEvent.Certainty;
import com.github.yildizmy.service.future.CashEvent.Kind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Projeção mensal (ADR 0021): the same events as the daily projection, added up per month. */
class MonthlyProjectionTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-23");

    private static CashEvent event(String date, String amount, Kind kind, Certainty certainty) {
        return new CashEvent(LocalDate.parse(date), new BigDecimal(amount), "x", kind, "X", certainty, "o", "r");
    }

    @Test
    void eachMonthSplitsConfirmedFromEstimatedAndKeepsThePlanApart() {
        List<CashEvent> events = List.of(
                event("2026-11-30", "-300.00", Kind.CARD_INVOICE, Certainty.CONFIRMED),
                event("2026-12-04", "5000.00", Kind.INCOME, Certainty.ESTIMATED),
                event("2026-12-04", "-750.00", Kind.PLAN, Certainty.CONFIRMED),
                event("2026-12-10", "-1500.00", Kind.RECURRING_EXPENSE, Certainty.ESTIMATED),
                event("2026-12-15", "-400.00", Kind.LOAN_INSTALLMENT, Certainty.CONFIRMED),
                event("2026-12-20", "200.00", Kind.INCOME, Certainty.CONFIRMED),
                event("2027-01-05", "5000.00", Kind.INCOME, Certainty.ESTIMATED),
                event("2027-02-05", "5000.00", Kind.INCOME, Certainty.ESTIMATED));

        List<MonthlyProjection.Month> months = MonthlyProjection.summarize(TODAY, new BigDecimal("1000.00"), events, 3);

        assertEquals(List.of(YearMonth.of(2026, 11), YearMonth.of(2026, 12), YearMonth.of(2027, 1)),
                months.stream().map(MonthlyProjection.Month::month).toList(), "the event in February is past the horizon");
        assertTrue(months.get(0).partial(), "only the days from today on");
        assertFalse(months.get(1).partial());

        MonthlyProjection.Month november = months.get(0);
        assertEquals(new BigDecimal("300.00"), november.outflowConfirmed());
        assertEquals(new BigDecimal("-300.00"), november.net());
        assertEquals(new BigDecimal("700.00"), november.endBalance());

        MonthlyProjection.Month december = months.get(1);
        assertEquals(new BigDecimal("200.00"), december.inflowConfirmed());
        assertEquals(new BigDecimal("5000.00"), december.inflowEstimated());
        assertEquals(new BigDecimal("400.00"), december.outflowConfirmed());
        assertEquals(new BigDecimal("1500.00"), december.outflowEstimated());
        assertEquals(new BigDecimal("750.00"), december.plan());
        assertEquals(new BigDecimal("2550.00"), december.net(), "5200 in, 1900 out, 750 to the plan");
        assertEquals(new BigDecimal("3250.00"), december.endBalance());
        assertEquals(new BigDecimal("8250.00"), months.get(2).endBalance());
    }

    @Test
    void withoutEventsEveryMonthIsZeroAndTheBalanceStays() {
        List<MonthlyProjection.Month> months = MonthlyProjection.summarize(TODAY, new BigDecimal("1000.00"), List.of(), 12);

        assertEquals(12, months.size());
        assertEquals(YearMonth.of(2027, 10), months.get(11).month());
        assertEquals(BigDecimal.ZERO, months.get(11).net());
        assertEquals(new BigDecimal("1000.00"), months.get(11).endBalance());
    }
}
