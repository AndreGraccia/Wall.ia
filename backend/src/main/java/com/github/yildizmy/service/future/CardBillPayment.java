package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
                var total = card.billedTotal(invoice);
                if (total.signum() > 0 && total.compareTo(movement.amount()) == 0) return true;
            }
        }
        return false;
    }

    /** Words of a card or bank name that say nothing about which card it is. */
    private static final Set<String> GENERIC = Set.of("banco", "bank", "card", "cartao", "credito", "final",
            "platinum", "gold", "black", "sandbox", "pagamentos", "internacional", "nacional");

    /**
     * Bills already closed, not yet due, that the bank statement shows as paid: the money has left the balance, so
     * the projection must not take it again. Conservative on purpose: a payment counts when it names exactly one
     * card (partial payments add up, never above the bill), or when its value equals exactly one open bill. Anything
     * else leaves the projection untouched, because hiding a bill is worse than showing it.
     *
     * @param bankMovements movements imported from the bank only; entries typed by hand prove nothing
     */
    public static List<CardPlan> withEarlyPayments(List<CardPlan> cards, List<Movement> bankMovements, LocalDate today) {
        Map<Long, YearMonth> open = new HashMap<>();
        for (CardPlan card : cards) {
            for (YearMonth invoice : List.of(YearMonth.from(today), YearMonth.from(today).plusMonths(1))) {
                if (!card.dueDate(invoice).isBefore(today) && !closingOf(card, invoice).isAfter(today)
                        && card.billedTotal(invoice).signum() > 0) {
                    open.putIfAbsent(card.id(), invoice);
                }
            }
        }
        Map<Long, BigDecimal> named = new HashMap<>();
        List<Movement> unnamed = new ArrayList<>();
        for (Movement movement : bankMovements) {
            if (movement.direction() != Direction.OUT || movement.date().isAfter(today)) continue;
            String text = RecurrenceDetector.normalize(movement.counterparty());
            List<CardPlan> mentioned = cards.stream().filter(card -> names(text, card)).toList();
            if (mentioned.isEmpty()) {
                unnamed.add(movement);
            } else if (mentioned.size() == 1 && describedAsBill(text) && paysOpenBill(movement, mentioned.get(0), open)) {
                named.merge(mentioned.get(0).id(), movement.amount(), BigDecimal::add);
            }
        }
        Map<Long, BigDecimal> paid = new HashMap<>();
        for (CardPlan card : cards) {
            BigDecimal sum = named.get(card.id());
            if (sum != null && sum.compareTo(card.billedTotal(open.get(card.id()))) <= 0) paid.put(card.id(), sum);
        }
        for (Movement movement : unnamed) {
            List<CardPlan> matches = cards.stream()
                    .filter(card -> !paid.containsKey(card.id()) && paysOpenBill(movement, card, open)
                            && card.billedTotal(open.get(card.id())).compareTo(movement.amount()) == 0)
                    .toList();
            if (matches.size() == 1) paid.put(matches.get(0).id(), movement.amount());
        }
        return cards.stream()
                .map(card -> paid.containsKey(card.id())
                        ? card.withPaid(Map.of(open.get(card.id()), paid.get(card.id()))) : card)
                .toList();
    }

    private static boolean paysOpenBill(Movement movement, CardPlan card, Map<Long, YearMonth> open) {
        YearMonth invoice = open.get(card.id());
        return invoice != null && !movement.date().isBefore(closingOf(card, invoice));
    }

    private static LocalDate closingOf(CardPlan card, YearMonth invoice) {
        return card.closingDate(card.dueDay() > card.closingDay() ? invoice : invoice.minusMonths(1));
    }

    private static boolean names(String text, CardPlan card) {
        List<String> words = Arrays.asList(text.split("\\W+"));
        return Arrays.stream(RecurrenceDetector.normalize(card.name() + " " + card.institution()).split("\\W+"))
                .anyMatch(word -> word.length() >= 4 && !GENERIC.contains(word) && words.contains(word));
    }

    public static List<Movement> withoutBillPayments(List<Movement> movements, List<CardPlan> cards) {
        return movements.stream().filter(movement -> !isBillPayment(movement, cards)).toList();
    }
}
