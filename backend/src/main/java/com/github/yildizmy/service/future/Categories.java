package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.RecurrenceDetector.Direction;

import java.util.Set;

/**
 * The cash-flow categories a person may pick (ADR 0024): the ones {@link MonthFlow} already shows, without the two
 * that are states rather than categories (UNCLASSIFIED and UNCONFIRMED_RECURRENCE).
 */
public final class Categories {

    private static final Set<String> IN = Set.of("SALARY", "OTHER_INCOME");
    private static final Set<String> OUT = Set.of(
            "ESSENTIAL", "LEISURE", "RENT", "BILL", "SUBSCRIPTION", "CARD_INVOICE", "LOAN", "OTHER");

    /** What the essentials slice of the month plan measures. */
    public static final Set<String> ESSENTIALS_SLICE = Set.of("ESSENTIAL", "RENT", "BILL", "SUBSCRIPTION");

    private Categories() {
    }

    public static boolean allowed(Direction direction, String category) {
        return category != null && (direction == Direction.IN ? IN : OUT).contains(category);
    }
}
