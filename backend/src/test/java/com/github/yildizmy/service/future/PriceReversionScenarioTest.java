package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEvent.Certainty;
import com.github.yildizmy.service.future.CashEvent.Kind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PriceReversionScenarioTest {

    @Test
    void comparesKeepingHigherPriceWithReturningToHistoricalMedian() {
        LocalDate today = LocalDate.parse("2026-10-26");
        CashEvent recurring = new CashEvent(
                LocalDate.parse("2026-11-04"), new BigDecimal("-49.90"), "Streaming Plus",
                Kind.RECURRING_EXPENSE, "SUBSCRIPTION", Certainty.ESTIMATED,
                "Banco de teste · Conta principal", "out:streaming-plus");
        CashEvent rent = new CashEvent(
                LocalDate.parse("2026-11-07"), new BigDecimal("-1200.00"), "Aluguel",
                Kind.RECURRING_EXPENSE, "RENT", Certainty.CONFIRMED,
                "Banco de teste · Conta principal", "out:rent");
        List<CashEvent> source = List.of(recurring, rent);

        var comparison = PriceReversionScenario.build(
                today, today.plusDays(90), source,
                "out:streaming-plus", "Streaming Plus", "Conta principal", "Banco de teste",
                LocalDate.parse("2026-11-04"), 30,
                new BigDecimal("49.90"), new BigDecimal("39.90"));

        assertEquals(3, comparison.chargeDates().size());
        assertEquals(3, comparison.keepCurrentPrice().stream()
                .filter(event -> event.certainty() == Certainty.HYPOTHETICAL).count());
        assertEquals(3, comparison.returnToPreviousPrice().stream()
                .filter(event -> event.certainty() == Certainty.HYPOTHETICAL).count());
        assertEquals(new BigDecimal("-49.90"), comparison.keepCurrentPrice().stream()
                .filter(event -> event.certainty() == Certainty.HYPOTHETICAL)
                .findFirst().orElseThrow().amount());
        assertEquals(new BigDecimal("-39.90"), comparison.returnToPreviousPrice().stream()
                .filter(event -> event.certainty() == Certainty.HYPOTHETICAL)
                .findFirst().orElseThrow().amount());
        assertEquals(1, comparison.replacedProjectedCharges());
        assertEquals(2, source.size());
        assertEquals(new BigDecimal("-49.90"), source.get(0).amount());
        assertTrue(comparison.keepCurrentPrice().stream().anyMatch(event -> event.label().equals("Aluguel")));
        assertTrue(comparison.returnToPreviousPrice().stream().anyMatch(event -> event.label().equals("Aluguel")));
        assertNotSame(source, comparison.keepCurrentPrice());
        assertNotSame(source, comparison.returnToPreviousPrice());
    }

    @Test
    void advancesStaleExpectedDateAndDoesNotAddEventsOutsideTheHorizon() {
        LocalDate today = LocalDate.parse("2026-10-26");
        var comparison = PriceReversionScenario.build(
                today, today.plusDays(90), List.of(),
                "out:music", "Music", "Conta principal", "Banco de teste",
                LocalDate.parse("2026-09-01"), 30,
                new BigDecimal("30.00"), new BigDecimal("20.00"));

        assertEquals(LocalDate.parse("2026-10-31"), comparison.chargeDates().get(0));
        assertTrue(comparison.chargeDates().stream().allMatch(date -> !date.isAfter(today.plusDays(90))));
    }

    @Test
    void refusesInvalidOrNonIncreasingPriceComparisons() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () ->
                PriceReversionScenario.build(
                        LocalDate.parse("2026-10-26"), LocalDate.parse("2027-01-24"), List.of(),
                        "out:music", "Music", "Conta principal", "Banco de teste",
                        LocalDate.parse("2026-11-15"), 30,
                        new BigDecimal("20.00"), new BigDecimal("20.00")));
    }
}
