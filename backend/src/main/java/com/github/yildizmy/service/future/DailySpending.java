package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Estimates everyday spending (market, transport, pharmacy): the outflows that are not a monthly bill.
 * <p>
 * Without it the projection only knows fixed bills and looks better than reality. Like a recurrence,
 * the estimate is a <em>question</em>: it only enters the projection after the user confirms it, and it
 * carries the evidence (period, total, where the money went) so the user can judge it.
 */
public final class DailySpending {

    static final int WINDOW_DAYS = 90;
    /** Less history than this and an average says more about the calendar than about the person. */
    static final int MIN_HISTORY_DAYS = 28;
    static final int TOP_ITEMS = 5;

    private DailySpending() {
    }

    /**
     * @param fixedKeys movement keys ({@link RecurrenceDetector#keyOf}) that are monthly bills or open
     *                  questions about bills; they are projected on their own and must not be counted twice
     */
    public static Optional<Estimate> estimate(LocalDate today, List<Movement> movements, Set<String> fixedKeys) {
        LocalDate from = today.minusDays(WINDOW_DAYS);
        List<Movement> recent = movements.stream()
                .filter(movement -> !movement.date().isBefore(from) && movement.date().isBefore(today))
                .toList();
        if (recent.isEmpty()) return Optional.empty();

        LocalDate firstSeen = recent.stream().map(Movement::date).min(Comparator.naturalOrder()).orElseThrow();
        int days = (int) ChronoUnit.DAYS.between(firstSeen, today);
        if (days < MIN_HISTORY_DAYS) return Optional.empty();

        List<Movement> variable = everyday(recent, fixedKeys);
        if (variable.isEmpty()) return Optional.empty();

        BigDecimal total = variable.stream().map(Movement::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, List<Movement>> byCounterparty = variable.stream()
                .collect(Collectors.groupingBy(Movement::counterparty, LinkedHashMap::new, Collectors.toList()));
        List<Item> top = byCounterparty.entrySet().stream()
                .map(entry -> new Item(
                        entry.getKey(),
                        entry.getValue().stream().map(Movement::amount).reduce(BigDecimal.ZERO, BigDecimal::add),
                        entry.getValue().size()))
                .sorted(Comparator.comparing(Item::total).reversed())
                .limit(TOP_ITEMS)
                .toList();

        return Optional.of(new Estimate(
                total.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP),
                total,
                days,
                variable.size(),
                top));
    }

    /**
     * The outflows of {@code movements} that are everyday spending: not a bill projected on its own, not a card bill
     * or loan, not money going to and coming back from the same counterparty. One rule for the average above, the
     * leisure slice of the month plan and the "Entradas e saídas" categories (ADR 0021).
     */
    public static List<Movement> everyday(List<Movement> movements, Set<String> fixedKeys) {
        // ponytail: a counterparty that both sends and receives money is treated as the user's own
        // account (e.g. "reserva"), same idea as the detector's internal pairs. A friend who pays you
        // back would be excluded too; refine with account ownership when real Open Finance data arrives.
        Set<String> twoWay = movements.stream()
                .collect(Collectors.groupingBy(movement -> RecurrenceDetector.counterpartyKey(movement.counterparty()),
                        Collectors.mapping(Movement::direction, Collectors.toSet())))
                .entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        return movements.stream()
                .filter(movement -> movement.direction() == Direction.OUT)
                .filter(movement -> !RecurrenceDetector.coveredElsewhere(movement.counterparty()))
                .filter(movement -> !fixedKeys.contains(RecurrenceDetector.keyOf(movement)))
                .filter(movement -> !twoWay.contains(RecurrenceDetector.counterpartyKey(movement.counterparty())))
                .toList();
    }

    /**
     * Everyday purchases on credit cards (food delivery, fuel): single-payment charges of the last 90 days.
     * Future invoices only know purchases already made, so without this they look lighter than they will be.
     * Instalment purchases are left out: their future instalments are already on the invoices.
     */
    public static Optional<Estimate> estimateCard(LocalDate today, List<CardPlan> cards) {
        LocalDate from = today.minusDays(WINDOW_DAYS);
        List<CardPlan.Charge> recent = cards.stream()
                .flatMap(card -> card.charges().stream())
                .filter(charge -> !charge.purchaseDate().isBefore(from) && charge.purchaseDate().isBefore(today))
                .toList();
        if (recent.isEmpty()) return Optional.empty();
        LocalDate firstSeen = recent.stream().map(CardPlan.Charge::purchaseDate).min(Comparator.naturalOrder()).orElseThrow();
        int days = (int) ChronoUnit.DAYS.between(firstSeen, today);
        if (days < MIN_HISTORY_DAYS) return Optional.empty();

        List<CardPlan.Charge> single = recent.stream().filter(charge -> charge.installments() == 1).toList();
        if (single.isEmpty()) return Optional.empty();
        BigDecimal total = single.stream().map(CardPlan.Charge::totalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Item> top = single.stream()
                .collect(Collectors.groupingBy(CardPlan.Charge::description, LinkedHashMap::new, Collectors.toList()))
                .entrySet().stream()
                .map(entry -> new Item(
                        entry.getKey(),
                        entry.getValue().stream().map(CardPlan.Charge::totalAmount).reduce(BigDecimal.ZERO, BigDecimal::add),
                        entry.getValue().size()))
                .sorted(Comparator.comparing(Item::total).reversed())
                .limit(TOP_ITEMS)
                .toList();
        return Optional.of(new Estimate(
                total.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP), total, days, single.size(), top));
    }

    /**
     * @param daily     average per calendar day, rounded to cents
     * @param total     sum of the everyday outflows in the period
     * @param days      length of the period, from the first movement seen to yesterday
     * @param movements how many outflows were counted
     * @param top       where most of the money went, largest first
     */
    public record Estimate(BigDecimal daily, BigDecimal total, int days, int movements, List<Item> top) {
    }

    public record Item(String counterparty, BigDecimal total, int count) {
    }
}
