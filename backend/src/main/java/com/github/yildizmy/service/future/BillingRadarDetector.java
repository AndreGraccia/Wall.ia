package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Finds review-worthy patterns in settled outbound movements.
 *
 * <p>Recurring charges are detected by counterparty and monthly cadence, independently of amount
 * stability. This is intentional: a price increase must not make a subscription disappear from
 * the radar. Similar same-day charges are only labelled as possible duplicates; legitimate repeated
 * purchases can produce the same signal and must be reviewed by the user.</p>
 */
public final class BillingRadarDetector {

    private static final long MIN_MONTHLY_GAP_DAYS = 20;
    private static final long MAX_MONTHLY_GAP_DAYS = 40;
    private static final BigDecimal MIN_INCREASE_AMOUNT = new BigDecimal("2.00");
    private static final BigDecimal MIN_INCREASE_PERCENT = new BigDecimal("10.0");
    private static final int MAX_EVIDENCE = 6;

    private BillingRadarDetector() {
    }

    public static List<Signal> detect(List<RecurrenceDetector.Movement> movements) {
        Map<String, List<RecurrenceDetector.Movement>> groups = movements.stream()
                .filter(movement -> movement.direction() == RecurrenceDetector.Direction.OUT)
                .filter(movement -> movement.amount() != null && movement.amount().signum() > 0)
                .filter(movement -> !isGenericTransfer(movement.counterparty()))
                .map(movement -> Map.entry(RecurrenceDetector.counterpartyKey(movement.counterparty()), movement))
                .filter(entry -> !entry.getKey().isBlank())
                .collect(Collectors.groupingBy(Map.Entry::getKey, LinkedHashMap::new,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList())));

        List<Signal> signals = new ArrayList<>();
        groups.forEach((key, group) -> analyse(key, group).ifPresent(signals::add));
        return signals.stream()
                .sorted(Comparator.comparingInt((Signal signal) -> signal.priceIncrease() ? 0
                                : signal.possibleDuplicate() ? 1 : 2)
                        .thenComparing(Signal::latestAmount, Comparator.reverseOrder()))
                .toList();
    }

    private static java.util.Optional<Signal> analyse(String key, List<RecurrenceDetector.Movement> group) {
        List<RecurrenceDetector.Movement> sorted = group.stream()
                .sorted(Comparator.comparing(RecurrenceDetector.Movement::date)
                        .thenComparingLong(RecurrenceDetector.Movement::id))
                .toList();

        Duplicate duplicate = findDuplicate(sorted);
        List<RecurrenceDetector.Movement> monthly = monthlyTail(monthlyObservations(sorted));
        boolean recurring = monthly.size() >= 2;

        RecurrenceDetector.Movement latest = monthly.isEmpty() ? sorted.get(sorted.size() - 1)
                : monthly.get(monthly.size() - 1);
        BigDecimal baseline = null;
        BigDecimal increase = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        BigDecimal increasePercent = BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
        LocalDate nextExpected = null;
        boolean priceIncrease = false;

        if (recurring) {
            List<BigDecimal> previousAmounts = monthly.subList(0, monthly.size() - 1).stream()
                    .map(RecurrenceDetector.Movement::amount).sorted().toList();
            baseline = median(previousAmounts);
            BigDecimal delta = latest.amount().subtract(baseline);
            increase = delta.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            increasePercent = baseline.signum() > 0
                    ? delta.multiply(new BigDecimal("100")).divide(baseline, 1, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
            priceIncrease = delta.compareTo(MIN_INCREASE_AMOUNT) >= 0
                    && increasePercent.compareTo(MIN_INCREASE_PERCENT) >= 0;
            long lastGap = ChronoUnit.DAYS.between(monthly.get(monthly.size() - 2).date(), latest.date());
            nextExpected = latest.date().plusDays(lastGap);
        }

        if (!recurring && duplicate == null) return java.util.Optional.empty();

        String counterparty = latest.counterparty();
        String confidence = duplicate != null && !recurring ? "REVIEW"
                : monthly.size() >= 3 ? "HIGH" : "MEDIUM";
        List<Occurrence> evidence = sorted.stream()
                .sorted(Comparator.comparing(RecurrenceDetector.Movement::date).reversed()
                        .thenComparing(Comparator.comparingLong(RecurrenceDetector.Movement::id).reversed()))
                .limit(MAX_EVIDENCE)
                .map(movement -> new Occurrence(movement.id(), movement.date(), movement.amount(),
                        movement.accountName(), movement.institution()))
                .toList();

        return java.util.Optional.of(new Signal(
                key,
                counterparty,
                recurring,
                priceIncrease,
                duplicate != null,
                confidence,
                latest.amount().setScale(2, RoundingMode.HALF_UP),
                baseline,
                increase,
                increasePercent,
                latest.date(),
                nextExpected,
                monthly.size(),
                duplicate == null ? null : duplicate.date(),
                duplicate == null ? null : duplicate.amount(),
                duplicate == null ? 0 : duplicate.count(),
                evidence
        ));
    }

    private static List<RecurrenceDetector.Movement> monthlyObservations(
            List<RecurrenceDetector.Movement> sorted) {
        Map<YearMonth, RecurrenceDetector.Movement> lastInMonth = new TreeMap<>();
        for (RecurrenceDetector.Movement movement : sorted) {
            YearMonth month = YearMonth.from(movement.date());
            lastInMonth.merge(month, movement, (first, next) ->
                    first.date().isAfter(next.date()) ? first : next);
        }
        return lastInMonth.values().stream()
                .sorted(Comparator.comparing(RecurrenceDetector.Movement::date))
                .toList();
    }

    /** Keep the most recent uninterrupted run of monthly-like gaps. */
    private static List<RecurrenceDetector.Movement> monthlyTail(
            List<RecurrenceDetector.Movement> monthly) {
        if (monthly.size() < 2) return monthly;
        int start = monthly.size() - 1;
        while (start > 0) {
            long gap = ChronoUnit.DAYS.between(monthly.get(start - 1).date(), monthly.get(start).date());
            if (gap < MIN_MONTHLY_GAP_DAYS || gap > MAX_MONTHLY_GAP_DAYS) break;
            start--;
        }
        return monthly.subList(start, monthly.size());
    }

    private static Duplicate findDuplicate(List<RecurrenceDetector.Movement> sorted) {
        Map<String, List<RecurrenceDetector.Movement>> byDayAndAmount = sorted.stream()
                .collect(Collectors.groupingBy(
                        movement -> movement.date() + "|" + movement.amount().stripTrailingZeros().toPlainString(),
                        LinkedHashMap::new, Collectors.toList()));
        return byDayAndAmount.values().stream()
                .filter(items -> items.size() > 1)
                .map(items -> new Duplicate(items.get(0).date(), items.get(0).amount(), items.size()))
                .max(Comparator.comparingInt(Duplicate::count).thenComparing(Duplicate::date))
                .orElse(null);
    }

    private static boolean isGenericTransfer(String counterparty) {
        String normalized = RecurrenceDetector.counterpartyKey(counterparty);
        return normalized.isBlank()
                || normalized.equals("transferencia-enviada")
                || normalized.equals("transferencia-recebida")
                || normalized.equals("deposito")
                || normalized.equals("retirada");
    }

    private static BigDecimal median(List<BigDecimal> sorted) {
        int middle = sorted.size() / 2;
        BigDecimal value = sorted.size() % 2 == 1
                ? sorted.get(middle)
                : sorted.get(middle - 1).add(sorted.get(middle))
                        .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_EVEN);
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    private record Duplicate(LocalDate date, BigDecimal amount, int count) {
    }

    public record Occurrence(long transactionId, LocalDate date, BigDecimal amount,
                             String accountName, String institution) {
    }

    public record Signal(String key, String counterparty, boolean recurring, boolean priceIncrease,
                         boolean possibleDuplicate, String confidence, BigDecimal latestAmount,
                         BigDecimal baselineAmount, BigDecimal increaseAmount, BigDecimal increasePercent,
                         LocalDate lastChargeDate, LocalDate nextExpectedDate, int occurrences,
                         LocalDate duplicateDate, BigDecimal duplicateAmount, int duplicateCount,
                         List<Occurrence> evidence) {
    }
}
