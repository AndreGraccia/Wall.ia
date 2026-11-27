package com.github.yildizmy.service.future;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BillingRadarDetectorTest {

    @Test
    void monthlyPriceIncreaseKeepsTheChargeVisibleAndShowsItsEvidence() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-05", "39.90", RecurrenceDetector.Direction.OUT, "Streaming Plus"),
                movement(2, "2026-09-05", "39.90", RecurrenceDetector.Direction.OUT, "Streaming Plus"),
                movement(3, "2026-10-05", "49.90", RecurrenceDetector.Direction.OUT, "Streaming Plus"));

        BillingRadarDetector.Signal signal = BillingRadarDetector.detect(movements).get(0);

        assertTrue(signal.recurring());
        assertTrue(signal.priceIncrease());
        assertEquals(new BigDecimal("39.90"), signal.baselineAmount());
        assertEquals(new BigDecimal("10.00"), signal.increaseAmount());
        assertEquals(new BigDecimal("25.1"), signal.increasePercent());
        assertEquals(LocalDate.parse("2026-11-04"), signal.nextExpectedDate());
        assertEquals(3, signal.occurrences());
        assertEquals(3, signal.evidence().size());
    }

    @Test
    void stableMonthlyChargeIsVisibleWithoutAnIncreaseAlert() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-05", "19.90", RecurrenceDetector.Direction.OUT, "Video App"),
                movement(2, "2026-09-05", "19.90", RecurrenceDetector.Direction.OUT, "Video App"),
                movement(3, "2026-10-05", "19.90", RecurrenceDetector.Direction.OUT, "Video App"));

        BillingRadarDetector.Signal signal = BillingRadarDetector.detect(movements).get(0);

        assertTrue(signal.recurring());
        assertFalse(signal.priceIncrease());
        assertFalse(signal.possibleDuplicate());
    }

    @Test
    void sameMerchantSameDayAndAmountIsOnlyFlaggedAsPossibleDuplicate() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-10-05", "42.00", RecurrenceDetector.Direction.OUT, "Mercado do Bairro"),
                movement(2, "2026-10-05", "42.00", RecurrenceDetector.Direction.OUT, "Mercado do Bairro"));

        BillingRadarDetector.Signal signal = BillingRadarDetector.detect(movements).get(0);

        assertTrue(signal.possibleDuplicate());
        assertFalse(signal.recurring());
        assertEquals(2, signal.duplicateCount());
        assertEquals(LocalDate.parse("2026-10-05"), signal.duplicateDate());
        assertNotNull(signal.duplicateAmount());
    }

    @Test
    void sameMerchantAndAmountInDifferentAccountsIsNotADuplicate() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-10-05", "42.00", RecurrenceDetector.Direction.OUT,
                        "Mercado do Bairro", "Conta A", "Banco A"),
                movement(2, "2026-10-05", "42.00", RecurrenceDetector.Direction.OUT,
                        "Mercado do Bairro", "Conta B", "Banco B"));

        assertTrue(BillingRadarDetector.detect(movements).isEmpty());
    }

    @Test
    void sameMerchantRecurringOnTwoAccountsDoesNotCombinePriceHistory() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-05", "39.90", RecurrenceDetector.Direction.OUT,
                        "Streaming Plus", "Conta A", "Banco A"),
                movement(2, "2026-09-05", "39.90", RecurrenceDetector.Direction.OUT,
                        "Streaming Plus", "Conta A", "Banco A"),
                movement(3, "2026-10-05", "49.90", RecurrenceDetector.Direction.OUT,
                        "Streaming Plus", "Conta B", "Banco B"));

        List<BillingRadarDetector.Signal> signals = BillingRadarDetector.detect(movements);

        assertEquals(1, signals.size());
        assertTrue(signals.get(0).recurring());
        assertFalse(signals.get(0).priceIncrease());
        assertEquals(2, signals.get(0).occurrences());
        assertTrue(signals.get(0).key().contains("conta-a"));
    }

    @Test
    void inboundTransfersAndGenericMovementNamesAreNotBills() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-05", "100.00", RecurrenceDetector.Direction.IN, "Streaming Plus"),
                movement(2, "2026-09-05", "100.00", RecurrenceDetector.Direction.OUT, "Transferência enviada"),
                movement(3, "2026-10-05", "100.00", RecurrenceDetector.Direction.OUT, "Transferência enviada"));

        assertTrue(BillingRadarDetector.detect(movements).isEmpty());
    }

    @Test
    void isolatedChargesAreNotPresentedAsMonthlySubscriptions() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-05", "20.00", RecurrenceDetector.Direction.OUT, "Loja Exemplo"),
                movement(2, "2026-10-05", "20.00", RecurrenceDetector.Direction.OUT, "Loja Exemplo"));

        assertTrue(BillingRadarDetector.detect(movements).isEmpty());
    }

    @Test
    void groceriesWithVaryingAmountsAreNotCountedAsRecurringCharges() {
        // The sandbox market: four purchases a month, R$ 179 to R$ 263. A habit, not a bill to review.
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-03", "231.80", RecurrenceDetector.Direction.OUT, "Mercado Bairro"),
                movement(2, "2026-08-27", "205.60", RecurrenceDetector.Direction.OUT, "Mercado Bairro"),
                movement(3, "2026-09-27", "179.35", RecurrenceDetector.Direction.OUT, "Mercado Bairro"),
                movement(4, "2026-10-27", "262.75", RecurrenceDetector.Direction.OUT, "Mercado Bairro"));

        assertTrue(BillingRadarDetector.detect(movements).isEmpty());
    }

    @Test
    void pharmacyAndFuelWithVaryingAmountsAreAHabitButAStreamingPriceRiseStays() {
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-04", "40.00", RecurrenceDetector.Direction.OUT, "Drogaria Central"),
                movement(2, "2026-09-04", "95.00", RecurrenceDetector.Direction.OUT, "Drogaria Central"),
                movement(3, "2026-08-23", "120.00", RecurrenceDetector.Direction.OUT, "Posto Shell"),
                movement(4, "2026-09-23", "210.00", RecurrenceDetector.Direction.OUT, "Posto Shell"),
                movement(5, "2026-08-15", "39.90", RecurrenceDetector.Direction.OUT, "Netflix"),
                movement(6, "2026-09-15", "55.90", RecurrenceDetector.Direction.OUT, "Netflix"));

        assertEquals(List.of("Netflix"),
                BillingRadarDetector.detect(movements).stream().map(BillingRadarDetector.Signal::counterparty).toList());
    }

    @Test
    void fixedBillsThatVaryALittleStayRecurring() {
        // Rent is exact and electricity moves about 20%: both stay, the everyday rule must not touch them.
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-18", "176.40", RecurrenceDetector.Direction.OUT, "Enel Distribuição SP"),
                movement(2, "2026-09-18", "203.10", RecurrenceDetector.Direction.OUT, "Enel Distribuição SP"),
                movement(3, "2026-10-18", "214.30", RecurrenceDetector.Direction.OUT, "Enel Distribuição SP"),
                movement(4, "2026-08-01", "1500.00", RecurrenceDetector.Direction.OUT, "Imobiliária Lar Seguro"),
                movement(5, "2026-09-01", "1500.00", RecurrenceDetector.Direction.OUT, "Imobiliária Lar Seguro"),
                movement(6, "2026-10-01", "1500.00", RecurrenceDetector.Direction.OUT, "Imobiliária Lar Seguro"));

        List<BillingRadarDetector.Signal> signals = BillingRadarDetector.detect(movements);

        assertEquals(2, signals.size());
        assertTrue(signals.stream().allMatch(BillingRadarDetector.Signal::recurring));
    }

    @Test
    void aSupermarketSubscriptionWithAFixedPriceIsStillRecurring() {
        // Same everyday name, stable price (a delivery club): the amount rule keeps it on the radar.
        List<RecurrenceDetector.Movement> movements = List.of(
                movement(1, "2026-08-05", "14.90", RecurrenceDetector.Direction.OUT, "Supermercado Clube"),
                movement(2, "2026-09-05", "14.90", RecurrenceDetector.Direction.OUT, "Supermercado Clube"),
                movement(3, "2026-10-05", "14.90", RecurrenceDetector.Direction.OUT, "Supermercado Clube"));

        assertTrue(BillingRadarDetector.detect(movements).get(0).recurring());
    }

    @Test
    void theCategoryThePersonDecidedPrevailsOverTheName() {
        var out = RecurrenceDetector.Direction.OUT;
        var movements = List.of(movement(1, "2026-09-10", "100.00", out, "Mercado Clube"),
                movement(2, "2026-10-10", "180.00", out, "Mercado Clube"));
        assertTrue(BillingRadarDetector.detect(movements).isEmpty(), "by name: everyday shopping");

        var decided = java.util.Map.of(2L, new MonthFlow.Choice("SUBSCRIPTION", MonthFlow.Origin.CHOSEN));

        assertTrue(BillingRadarDetector.detect(movements, decided).get(0).recurring());
    }

    private static RecurrenceDetector.Movement movement(long id, String date, String amount,
                                                         RecurrenceDetector.Direction direction, String counterparty) {
        return movement(id, date, amount, direction, counterparty, "Conta principal", "Banco de teste");
    }

    private static RecurrenceDetector.Movement movement(long id, String date, String amount,
                                                         RecurrenceDetector.Direction direction, String counterparty,
                                                         String accountName, String institution) {
        return new RecurrenceDetector.Movement(id, LocalDate.parse(date), new BigDecimal(amount), direction,
                counterparty, accountName, institution);
    }
}
