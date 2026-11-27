package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Entradas e saídas (proposta de André Graccia, ADR 0021): one month of settled movements, totalled by account, by
 * payment method and by category. Cash regime (ADR 0011): a card purchase is spending in the month the bill is paid.
 * Transfers between the person's own accounts never reach here; the caller removes them first.
 */
public final class MonthFlow {

    /** Local entries and imports from before V31 have no payment type. */
    public static final String UNKNOWN_METHOD = "UNKNOWN";

    private MonthFlow() {
    }

    /** @param paymentType Open Finance type (PIX, TED, BOLETO...), null when unknown */
    public record Line(Movement movement, String paymentType) {
    }

    public record Group(String key, BigDecimal total, int count) {
    }

    /**
     * One settled movement, with the same keys the groups use, so a screen can filter the list by any group.
     *
     * @param method   Open Finance payment type, or {@link #UNKNOWN_METHOD}
     * @param category same rule as {@code byCategory}
     */
    public record Item(long id, LocalDate date, String counterparty, BigDecimal amount, String account, String method,
                       String category) {
    }

    /** @param items the movements of the side, newest first */
    public record Side(BigDecimal total, int count, List<Group> byAccount, List<Group> byMethod, List<Group> byCategory,
                       List<Item> items) {
    }

    /** @param everyday the spending that is neither a bill nor a debt: what the leisure slice measures */
    public record Result(Side income, Side spending, BigDecimal everyday) {
    }

    /**
     * Categories: the one the person confirmed for the recurrence; CARD_INVOICE and LOAN for what is projected from
     * card and loan data; UNCONFIRMED_RECURRENCE for a recurrence still waiting for an answer; EVERYDAY for the rest of
     * the spending (same rule as the everyday average); UNCLASSIFIED for what nobody told us about. Never a guess.
     *
     * @param confirmedCategories pattern key to the category the person confirmed
     * @param pendingKeys         pattern keys nobody answered yet
     */
    public static Result of(List<Line> lines, Map<String, String> confirmedCategories, Set<String> pendingKeys,
                            List<CardPlan> cards) {
        Map<Line, String> categories = new LinkedHashMap<>();
        List<Line> candidates = new java.util.ArrayList<>();
        for (Line line : lines) {
            Movement movement = line.movement();
            String key = RecurrenceDetector.keyOf(movement);
            String category;
            if (movement.direction() == Direction.OUT && CardBillPayment.isBillPayment(movement, cards)) category = "CARD_INVOICE";
            else if (movement.direction() == Direction.OUT && RecurrenceDetector.coveredElsewhere(movement.counterparty())) category = "LOAN";
            else if (confirmedCategories.containsKey(key)) category = confirmedCategories.get(key);
            else if (pendingKeys.contains(key)) category = "UNCONFIRMED_RECURRENCE";
            else {
                category = "UNCLASSIFIED";
                candidates.add(line);
            }
            categories.put(line, category);
        }
        Set<String> fixedKeys = new HashSet<>(confirmedCategories.keySet());
        fixedKeys.addAll(pendingKeys);
        Set<Long> everydayIds = DailySpending.everyday(candidates.stream().map(Line::movement).toList(), fixedKeys).stream()
                .map(Movement::id).collect(Collectors.toSet());
        candidates.stream().filter(line -> everydayIds.contains(line.movement().id()))
                .forEach(line -> categories.put(line, "EVERYDAY"));

        List<Line> income = lines.stream().filter(line -> line.movement().direction() == Direction.IN).toList();
        List<Line> spending = lines.stream().filter(line -> line.movement().direction() == Direction.OUT).toList();
        BigDecimal everyday = sum(spending.stream().filter(line -> "EVERYDAY".equals(categories.get(line))).toList());
        return new Result(side(income, categories), side(spending, categories), everyday);
    }

    private static Side side(List<Line> lines, Map<Line, String> categories) {
        return new Side(sum(lines), lines.size(),
                groups(lines, line -> account(line.movement())),
                groups(lines, MonthFlow::method),
                groups(lines, categories::get),
                lines.stream()
                        .map(line -> new Item(line.movement().id(), line.movement().date(), line.movement().counterparty(),
                                line.movement().amount(), account(line.movement()), method(line), categories.get(line)))
                        .sorted(Comparator.comparing(Item::date).reversed().thenComparing(Item::id, Comparator.reverseOrder()))
                        .toList());
    }

    private static String method(Line line) {
        return line.paymentType() == null ? UNKNOWN_METHOD : line.paymentType();
    }

    private static List<Group> groups(List<Line> lines, Function<Line, String> key) {
        return lines.stream()
                .collect(Collectors.groupingBy(key, LinkedHashMap::new, Collectors.toList()))
                .entrySet().stream()
                .map(entry -> new Group(entry.getKey(), sum(entry.getValue()), entry.getValue().size()))
                .sorted(Comparator.comparing(Group::total).reversed().thenComparing(Group::key))
                .toList();
    }

    private static BigDecimal sum(List<Line> lines) {
        return lines.stream().map(line -> line.movement().amount()).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** "Banco · Conta", or just the account when its name already carries the institution. */
    static String account(Movement movement) {
        String name = movement.accountName() == null ? "" : movement.accountName();
        String institution = movement.institution();
        if (institution == null || institution.isBlank() || name.contains(institution)) return name;
        return name.isBlank() ? institution : institution + " · " + name;
    }
}
