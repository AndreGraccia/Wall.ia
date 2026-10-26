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

        assertTrue(BillingRadarDetector.detect(movements).isEmpty());
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
