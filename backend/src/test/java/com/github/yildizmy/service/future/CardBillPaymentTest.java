package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * B12 (partial, ADR 0020): paying the card bill from the account is the bill's purchases moving. The projection
 * already counts those purchases as the card invoice, so the payment must not also count as everyday spending.
 */
class CardBillPaymentTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 19);

    /** Closes on the 25th, due on the 3rd: the November invoice (due 03/11) holds a R$ 600,00 purchase. */
    private static final CardPlan CARD = new CardPlan(1, "Aurora Card", "Banco Aurora", 25, 3, List.of(
            new CardPlan.Charge(1, "Mercado Central", LocalDate.of(2026, 10, 10), new BigDecimal("600.00"),
                    new BigDecimal("600.00"), 1, YearMonth.of(2026, 11))));

    private static Movement out(long id, LocalDate date, String amount, String counterparty) {
        return new Movement(id, date, new BigDecimal(amount), Direction.OUT, counterparty, "Conta", "Banco Aurora");
    }

    /** 40 days of R$ 10,00 at the bakery, plus the bill payment the bank describes without saying "fatura". */
    private static List<Movement> history(String billDescription) {
        List<Movement> movements = new ArrayList<>();
        for (int day = 1; day <= 40; day++) movements.add(out(day, TODAY.minusDays(day), "10.00", "Padaria Sol"));
        movements.add(out(99, LocalDate.of(2026, 11, 3), "600.00", billDescription));
        return movements;
    }

    @Test
    void aPaymentOfExactlyTheInvoiceTotalNearItsDueDateIsTheBill() {
        assertTrue(CardBillPayment.isBillPayment(out(1, LocalDate.of(2026, 11, 4), "600.00", "NU PAGAMENTOS SA"), List.of(CARD)));
        assertFalse(CardBillPayment.isBillPayment(out(1, LocalDate.of(2026, 11, 4), "599.99", "NU PAGAMENTOS SA"), List.of(CARD)),
                "one cent off is another payment");
        assertFalse(CardBillPayment.isBillPayment(out(1, LocalDate.of(2026, 11, 20), "600.00", "NU PAGAMENTOS SA"), List.of(CARD)),
                "17 days after the due date is too far to be this bill");
    }

    @Test
    void theBankWordingForABillPaymentIsRecognisedWithoutTheAmount() {
        assertTrue(CardBillPayment.isBillPayment(out(1, TODAY, "123.45", "PAGTO CARTAO CREDITO"), List.of()));
        assertTrue(CardBillPayment.isBillPayment(out(1, TODAY, "123.45", "Pgto. Fatura Aurora"), List.of()));
        assertFalse(CardBillPayment.isBillPayment(out(1, TODAY, "123.45", "Cartório Central"), List.of()));
    }

    @Test
    void theBillPaymentNoLongerInflatesEverydaySpendingWhileTheInvoiceIsProjected() {
        // Before B12 the R$ 600,00 entered the 90-day average (+ R$ 15,00 a day) and the invoice also went out
        // on its due date: the same purchases twice in the projection.
        var before = DailySpending.estimate(TODAY, history("NU PAGAMENTOS SA"), Set.of()).orElseThrow();
        assertEquals(new BigDecimal("25.00"), before.daily(), "the double count this test guards against");

        var after = DailySpending.estimate(TODAY,
                CardBillPayment.withoutBillPayments(history("NU PAGAMENTOS SA"), List.of(CARD)), Set.of()).orElseThrow();
        assertEquals(new BigDecimal("10.00"), after.daily());
        assertEquals(40, after.movements());
    }

    @Test
    void aPaymentDescribedAsPagtoCartaoIsNotEverydaySpendingEvenWithoutCardData() {
        var estimate = DailySpending.estimate(TODAY, history("PAGTO CARTAO 4821"), Set.of()).orElseThrow();
        assertEquals(new BigDecimal("10.00"), estimate.daily());
    }

    @Test
    void incomeOfTheSameValueIsNeverABillPayment() {
        var refund = new Movement(1, LocalDate.of(2026, 11, 3), new BigDecimal("600.00"), Direction.IN, "Estorno", "Conta", "Banco");
        assertFalse(CardBillPayment.isBillPayment(refund, List.of(CARD)));
    }
}
