package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;

import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Paying the card bill from the account is the bill's purchases moving, not new spending (B12, ADR 0020). The
 * projection counts those purchases once, as the card invoice on its due date; this keeps the payment out of
 * everything estimated from the account history, so they are not counted a second time.
 * <p>
 * Two ways to recognise it: the bank's wording, or (when the wording says nothing, e.g. "NU PAGAMENTOS SA") a
 * payment of exactly an invoice total within {@link #DUE_DATE_DAYS} days of that invoice's due date.
 */
public final class CardBillPayment {

    /** A bill paid early or a few days late (closed bank day, slow boleto) is still the same bill. */
    static final int DUE_DATE_DAYS = 10;

    // ponytail: wording heuristic; the amount rule below is the structured one. A partial payment with neutral
    // wording (paying the minimum) still escapes both; needs the bills' payment history from Open Finance.
    private static final Pattern WORDING = Pattern.compile(
            "fatura|(pagamento|pagto|pgto|pag) (do |de |da )?cartao|cartao de credito");

    private CardBillPayment() {
    }

    static boolean describedAsBill(String normalizedCounterparty) {
        return WORDING.matcher(normalizedCounterparty).find();
    }

    public static boolean isBillPayment(Movement movement, List<CardPlan> cards) {
        if (movement.direction() != Direction.OUT) return false;
        if (describedAsBill(RecurrenceDetector.normalize(movement.counterparty()))) return true;
        YearMonth month = YearMonth.from(movement.date());
        for (CardPlan card : cards) {
            for (YearMonth invoice : List.of(month.minusMonths(1), month, month.plusMonths(1))) {
                long days = Math.abs(ChronoUnit.DAYS.between(card.dueDate(invoice), movement.date()));
                if (days > DUE_DATE_DAYS) continue;
                var total = card.invoiceTotal(invoice);
                if (total.signum() > 0 && total.compareTo(movement.amount()) == 0) return true;
            }
        }
        return false;
    }

    public static List<Movement> withoutBillPayments(List<Movement> movements, List<CardPlan> cards) {
        return movements.stream().filter(movement -> !isBillPayment(movement, cards)).toList();
    }
}
