package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Finds movements that look monthly (same counterparty, same direction, ~30 days apart).
 * <p>
 * A detected pattern is a <em>question</em>, never a fact: it only feeds projections after the
 * user confirms it. The detector therefore returns the full evidence (every occurrence) so the
 * UI can show why it is asking.
 */
public final class RecurrenceDetector {

    static final int MIN_GAP_DAYS = 20;
    static final int MAX_GAP_DAYS = 40;
    /** max/min amount ratio still considered "the same bill". */
    static final BigDecimal STABLE_RATIO = new BigDecimal("1.25");
    static final BigDecimal SUBSCRIPTION_CEILING = new BigDecimal("200");

    // ponytail: keyword heuristics for the suggestion only; the user's answer is what counts.
    private static final Pattern RENT = Pattern.compile("aluguel|imobiliari|condominio");
    // Card bills and loan instalments already come from card/loan data; counting them here would double them.
    // The card side of it lives in CardBillPayment, the one place that knows what a bill payment looks like (B12).
    private static final Pattern LOANS = Pattern.compile("emprestimo|financiamento|consorcio");
    private static final Pattern NOISE = Pattern.compile("[^a-z0-9 ]");

    private RecurrenceDetector() {
    }

    public static List<RecurrencePattern> detect(List<Movement> movements) {
        Map<String, List<Movement>> groups = movements.stream()
                .filter(movement -> movement.amount().signum() > 0)
                .filter(movement -> !coveredElsewhere(movement.counterparty()))
                .collect(Collectors.groupingBy(RecurrenceDetector::keyOf, LinkedHashMap::new, Collectors.toList()));

        List<RecurrencePattern> patterns = new ArrayList<>();
        groups.forEach((key, group) -> toPattern(key, group).ifPresent(patterns::add));

        // The same counterparty going both ways with similar values is money moving between the
        // user's own accounts (e.g. "reserva"): it is neither income nor expense.
        Set<String> internal = patterns.stream()
                .filter(pattern -> patterns.stream().anyMatch(other -> other != pattern
                        && other.direction() != pattern.direction()
                        && other.counterpartyKey().equals(pattern.counterpartyKey())
                        && ratio(other.typicalAmount(), pattern.typicalAmount()).compareTo(STABLE_RATIO) <= 0))
                .map(RecurrencePattern::key)
                .collect(Collectors.toSet());

        return patterns.stream()
                .filter(pattern -> !internal.contains(pattern.key()))
                .map(pattern -> pattern.withSuggestion(suggest(pattern, patterns)))
                .sorted(Comparator.comparing(RecurrencePattern::direction)
                        .thenComparing(RecurrencePattern::typicalAmount, Comparator.reverseOrder()))
                .toList();
    }

    private static java.util.Optional<RecurrencePattern> toPattern(String key, List<Movement> group) {
        List<Movement> sorted = group.stream().sorted(Comparator.comparing(Movement::date)).toList();
        if (sorted.size() < 2) return java.util.Optional.empty();
        long months = sorted.stream().map(movement -> YearMonth.from(movement.date())).distinct().count();
        if (months < 2) return java.util.Optional.empty();
        for (int i = 1; i < sorted.size(); i++) {
            long gap = ChronoUnit.DAYS.between(sorted.get(i - 1).date(), sorted.get(i).date());
            if (gap < MIN_GAP_DAYS || gap > MAX_GAP_DAYS) return java.util.Optional.empty();
        }

        List<BigDecimal> amounts = sorted.stream().map(Movement::amount).sorted().toList();
        BigDecimal min = amounts.get(0);
        BigDecimal max = amounts.get(amounts.size() - 1);
        boolean stableAmount = ratio(max, min).compareTo(STABLE_RATIO) <= 0;
        if (!stableAmount) return java.util.Optional.empty();

        List<Integer> daysOfMonth = circularDays(sorted.stream().map(movement -> movement.date().getDayOfMonth()).toList());
        int typicalDay = (daysOfMonth.get(daysOfMonth.size() / 2) - 1) % 31 + 1;
        int daySpread = daysOfMonth.get(daysOfMonth.size() - 1) - daysOfMonth.get(0);
        boolean fixedAmount = min.compareTo(max) == 0;
        Confidence confidence = sorted.size() >= 3 && daySpread <= 5 ? Confidence.HIGH : Confidence.MEDIUM;

        Movement last = sorted.get(sorted.size() - 1);
        return java.util.Optional.of(new RecurrencePattern(
                key,
                counterpartyKey(last.counterparty()),
                last.counterparty(),
                last.direction(),
                last.accountName(),
                last.institution(),
                median(amounts),
                fixedAmount,
                typicalDay,
                confidence,
                null,
                sorted.stream()
                        .map(movement -> new Occurrence(movement.id(), movement.date(), movement.amount()))
                        .toList()
        ));
    }

    /**
     * Days of month, sorted, treating the turn of the month as adjacent: a bill on the 30th that once
     * landed on the 1st is read as 30, 30, 32, not 1, 30, 30. Values above 31 mean "early next month".
     */
    static List<Integer> circularDays(List<Integer> days) {
        List<Integer> sorted = days.stream().sorted().toList();
        if (sorted.get(sorted.size() - 1) - sorted.get(0) <= 15) return sorted;
        return days.stream().mapToInt(Integer::intValue).map(day -> day < 15 ? day + 31 : day).sorted().boxed().toList();
    }

    private static Category suggest(RecurrencePattern pattern, List<RecurrencePattern> all) {
        String name = normalize(pattern.counterparty());
        if (pattern.direction() == Direction.IN) {
            BigDecimal largestIncome = all.stream()
                    .filter(other -> other.direction() == Direction.IN)
                    .map(RecurrencePattern::typicalAmount)
                    .max(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);
            return pattern.typicalAmount().compareTo(largestIncome) == 0 ? Category.SALARY : Category.OTHER_INCOME;
        }
        if (RENT.matcher(name).find()) return Category.RENT;
        if (pattern.fixedAmount() && pattern.typicalAmount().compareTo(SUBSCRIPTION_CEILING) < 0) {
            return Category.SUBSCRIPTION;
        }
        return Category.BILL;
    }

    /** Card bills and loan instalments: projected from card and loan data, never from the account history. */
    static boolean coveredElsewhere(String counterparty) {
        String normalized = normalize(counterparty);
        return CardBillPayment.describedAsBill(normalized) || LOANS.matcher(normalized).find();
    }

    static String keyOf(Movement movement) {
        return (movement.direction() == Direction.IN ? "in:" : "out:") + counterpartyKey(movement.counterparty());
    }

    public static String counterpartyKey(String counterparty) {
        String slug = normalize(counterparty).trim().replaceAll("\\s+", "-");
        return slug.length() <= 100 ? slug : slug.substring(0, 100);
    }

    static String normalize(String value) {
        if (value == null) return "";
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return NOISE.matcher(ascii.toLowerCase(Locale.ROOT)).replaceAll(" ").replaceAll("\\s+", " ").trim();
    }

    private static BigDecimal ratio(BigDecimal a, BigDecimal b) {
        BigDecimal high = a.max(b);
        BigDecimal low = a.min(b);
        return low.signum() == 0 ? BigDecimal.valueOf(Long.MAX_VALUE) : high.divide(low, 4, RoundingMode.HALF_UP);
    }

    private static BigDecimal median(List<BigDecimal> sorted) {
        int middle = sorted.size() / 2;
        BigDecimal value = sorted.size() % 2 == 1
                ? sorted.get(middle)
                : sorted.get(middle - 1).add(sorted.get(middle)).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_EVEN);
        return value.setScale(2, RoundingMode.HALF_EVEN);
    }

    public enum Direction { IN, OUT }

    public enum Confidence { HIGH, MEDIUM }

    public enum Category { SALARY, OTHER_INCOME, RENT, SUBSCRIPTION, BILL, OTHER }

    /** A settled movement as the detector sees it; amount is always positive, direction says the sign. */
    public record Movement(
            long id,
            LocalDate date,
            BigDecimal amount,
            Direction direction,
            String counterparty,
            String accountName,
            String institution
    ) {
    }

    public record Occurrence(long transactionId, LocalDate date, BigDecimal amount) {
    }

    public record RecurrencePattern(
            String key,
            String counterpartyKey,
            String counterparty,
            Direction direction,
            String accountName,
            String institution,
            BigDecimal typicalAmount,
            boolean fixedAmount,
            int typicalDay,
            Confidence confidence,
            Category suggestedCategory,
            List<Occurrence> occurrences
    ) {

        RecurrencePattern withSuggestion(Category category) {
            return new RecurrencePattern(key, counterpartyKey, counterparty, direction, accountName, institution,
                    typicalAmount, fixedAmount, typicalDay, confidence, category, occurrences);
        }
    }
}
