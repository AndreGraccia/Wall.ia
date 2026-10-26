package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEvent.Certainty;
import com.github.yildizmy.service.future.CashEvent.Kind;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Creates two isolated projections for a price-change alert without changing source transactions.
 * Existing projected items for the same bill are replaced so a scheduled bank entry is not counted twice.
 */
public final class PriceReversionScenario {

    private static final int MAX_MATCH_DAYS = 5;
    private static final int MIN_INTERVAL_DAYS = 20;
    private static final int MAX_INTERVAL_DAYS = 40;

    private PriceReversionScenario() {
    }

    public static Comparison build(
            LocalDate today,
            LocalDate end,
            List<CashEvent> sourceEvents,
            String signalKey,
            String counterparty,
            String accountName,
            String institution,
            LocalDate nextExpectedDate,
            int intervalDays,
            BigDecimal currentAmount,
            BigDecimal previousAmount) {
        Objects.requireNonNull(today, "today");
        Objects.requireNonNull(end, "end");
        Objects.requireNonNull(sourceEvents, "sourceEvents");
        Objects.requireNonNull(nextExpectedDate, "nextExpectedDate");
        requirePriceInputs(intervalDays, currentAmount, previousAmount);

        if (end.isBefore(today)) throw new IllegalArgumentException("end must not be before today");
        if (counterparty == null || counterparty.isBlank()) throw new IllegalArgumentException("counterparty is required");

        LocalDate next = nextExpectedDate;
        while (!next.isAfter(today)) next = next.plusDays(intervalDays);

        List<LocalDate> expectedDates = new ArrayList<>();
        for (LocalDate candidate = next; !candidate.isAfter(end); candidate = candidate.plusDays(intervalDays)) {
            LocalDate effective = BusinessDays.onOrAfter(candidate);
            if (!effective.isBefore(today) && !effective.isAfter(end)) expectedDates.add(effective);
        }
        if (expectedDates.isEmpty()) throw new IllegalArgumentException("no expected charges in the projection window");

        List<CashEvent> matchingExisting = sourceEvents.stream()
                .filter(event -> isMatchingOutflow(event, signalKey, counterparty, accountName, institution))
                .filter(event -> expectedDates.stream().anyMatch(date ->
                        Math.abs(ChronoUnit.DAYS.between(date, event.date())) <= MAX_MATCH_DAYS))
                .toList();

        Set<LocalDate> dates = new TreeSet<>(expectedDates);
        for (LocalDate expected : expectedDates) {
            matchingExisting.stream()
                    .filter(event -> Math.abs(ChronoUnit.DAYS.between(expected, event.date())) <= MAX_MATCH_DAYS)
                    .min(Comparator.comparingLong(event -> Math.abs(ChronoUnit.DAYS.between(expected, event.date()))))
                    .ifPresent(event -> {
                        dates.remove(expected);
                        dates.add(event.date());
                    });
        }

        Set<LongLikeEvent> matchingKeys = matchingExisting.stream()
                .map(LongLikeEvent::new)
                .collect(Collectors.toSet());
        List<CashEvent> common = sourceEvents.stream()
                .filter(event -> !matchingKeys.contains(new LongLikeEvent(event)))
                .collect(Collectors.toCollection(ArrayList::new));

        List<LocalDate> chargeDates = List.copyOf(dates);
        List<CashEvent> keepCurrentPrice = new ArrayList<>(common);
        List<CashEvent> returnToPreviousPrice = new ArrayList<>(common);
        for (int index = 0; index < chargeDates.size(); index++) {
            LocalDate date = chargeDates.get(index);
            keepCurrentPrice.add(hypotheticalCharge(date, currentAmount, counterparty,
                    "billing-radar:keep:" + signalKey + ":" + index));
            returnToPreviousPrice.add(hypotheticalCharge(date, previousAmount, counterparty,
                    "billing-radar:prior:" + signalKey + ":" + index));
        }

        return new Comparison(
                List.copyOf(keepCurrentPrice),
                List.copyOf(returnToPreviousPrice),
                chargeDates,
                matchingExisting.size()
        );
    }

    private static boolean isMatchingOutflow(
            CashEvent event,
            String signalKey,
            String counterparty,
            String accountName,
            String institution) {
        if (event.kind() != Kind.RECURRING_EXPENSE || event.isInflow()) return false;

        boolean sameCounterparty = RecurrenceDetector.counterpartyKey(event.label())
                .equals(RecurrenceDetector.counterpartyKey(counterparty));
        boolean sameAccount = contains(event.origin(), accountName) && contains(event.origin(), institution);
        boolean exactReference = signalKey != null && event.reference() != null
                && event.reference().equals(signalKey);
        boolean legacyReference = event.reference() != null
                && event.reference().equals("out:" + RecurrenceDetector.counterpartyKey(counterparty));
        return exactReference || ((legacyReference || sameCounterparty) && sameAccount);
    }

    private static boolean contains(String value, String part) {
        if (part == null || part.isBlank()) return true;
        return value != null && RecurrenceDetector.normalize(value).contains(RecurrenceDetector.normalize(part));
    }

    private static CashEvent hypotheticalCharge(LocalDate date, BigDecimal amount, String counterparty, String reference) {
        return new CashEvent(
                date,
                amount.negate(),
                counterparty,
                Kind.RECURRING_EXPENSE,
                "BILLING_RADAR_PRICE_SCENARIO",
                Certainty.HYPOTHETICAL,
                "Simulação hipotética do Radar de cobranças",
                reference
        );
    }

    private static void requirePriceInputs(int intervalDays, BigDecimal currentAmount, BigDecimal previousAmount) {
        if (intervalDays < MIN_INTERVAL_DAYS || intervalDays > MAX_INTERVAL_DAYS) {
            throw new IllegalArgumentException("interval must be between 20 and 40 days");
        }
        if (currentAmount == null || previousAmount == null
                || currentAmount.signum() <= 0 || previousAmount.signum() <= 0
                || currentAmount.compareTo(previousAmount) <= 0) {
            throw new IllegalArgumentException("current price must be greater than the positive previous price");
        }
    }

    public record Comparison(
            List<CashEvent> keepCurrentPrice,
            List<CashEvent> returnToPreviousPrice,
            List<LocalDate> chargeDates,
            int replacedProjectedCharges) {
    }

    /**
     * Event value identity used only inside this method to remove exact event objects without mutating input.
     * CashEvent has value semantics, but this wrapper makes the intent explicit and works even when equal events
     * happen to exist in the source list.
     */
    private record LongLikeEvent(LocalDate date, BigDecimal amount, String label, Kind kind, String category,
                                 Certainty certainty, String origin, String reference) {
        LongLikeEvent(CashEvent event) {
            this(event.date(), event.amount(), event.label(), event.kind(), event.category(),
                    event.certainty(), event.origin(), event.reference());
        }
    }
}
