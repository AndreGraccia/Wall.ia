package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEventPlanner.ConfirmedRecurrence;
import com.github.yildizmy.service.future.RecurrenceDetector.Confidence;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * "Meu método" (ADR 0021): which budgeting methods fit this person's data, by explicit rules and never by a score.
 * Each suggestion carries the reason as an i18n code plus the numbers behind it; the UI writes the sentence.
 * <p>
 * Rules, in this order (the first ones decide what comes first):
 * <ol>
 *   <li>Declared main goal (OTHER and NOT_SAID change nothing):
 *   <ul>
 *     <li>LEAVE_DEBT: DEBT_AVALANCHE, plus DEBT_SNOWBALL with two or more debts; with no debt with a rate on record,
 *         PRIORITIES (debts are never assumed).</li>
 *     <li>BUILD_RESERVE: with income PAY_YOURSELF_FIRST, plus PERCENT_BALANCED when the fixed bills are at most half
 *         of it; without income ENVELOPES.</li>
 *     <li>ORGANIZE_MONTH: INCOME_CYCLE with income, then ENVELOPES.</li>
 *     <li>STABILITY: INCOME_CYCLE with income, PRIORITIES without.</li>
 *   </ul></li>
 *   <li>Variable income: INCOME_CYCLE first.</li>
 *   <li>Confirmed fixed bills above half the confirmed income: PRIORITIES and INCOME_CYCLE, before any percent.</li>
 *   <li>Two or more debts with a rate: DEBT_AVALANCHE and DEBT_SNOWBALL.</li>
 *   <li>Declared preference: SIMPLE gives the percent presets; DETAILED gives ZERO_BASED and ENVELOPES.</li>
 *   <li>Fewer than two so far: PAY_YOURSELF_FIRST and INCOME_CYCLE with income; PRIORITIES and ENVELOPES without.</li>
 * </ol>
 * Without confirmed income, no percent method is suggested (there is no base) and the answer asks for the income.
 */
public final class MethodAdvisor {

    static final int MAX = 3;
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private MethodAdvisor() {
    }

    public enum Preference { SIMPLE, DETAILED, NOT_SAID }

    public enum Goal { STABILITY, LEAVE_DEBT, ORGANIZE_MONTH, BUILD_RESERVE, OTHER, NOT_SAID }

    /**
     * What the rules read. Derived from the data on every call, never stored.
     *
     * @param confirmedIncome monthly confirmed income, null when nothing was confirmed
     * @param fixedMonthly    confirmed rent, bills and subscriptions plus loan instalments, per month
     * @param debtsWithRate   loans with a rate and the debts typed by the person (they always carry the CET)
     */
    public record Facts(BigDecimal confirmedIncome, boolean variableIncome, BigDecimal fixedMonthly, int debtsWithRate,
                        Preference preference, Goal goal) {

        /** Fixed over income in percent, one decimal; null without income. */
        public BigDecimal fixedSharePercent() {
            if (confirmedIncome == null || confirmedIncome.signum() <= 0) return null;
            return fixedMonthly.multiply(HUNDRED).divide(confirmedIncome, 1, RoundingMode.HALF_UP);
        }
    }

    /** @param params the numbers behind the reason, for the UI to fill the sentence */
    public record Reason(String code, Map<String, BigDecimal> params) {
    }

    public record Suggestion(String method, List<Reason> reasons) {
    }

    public record Advice(boolean needsConfirmedIncome, List<Suggestion> suggestions) {
    }

    public static Advice suggest(Facts facts) {
        boolean income = facts.confirmedIncome() != null && facts.confirmedIncome().signum() > 0;
        boolean fixedAboveHalf = income
                && facts.fixedMonthly().multiply(BigDecimal.valueOf(2)).compareTo(facts.confirmedIncome()) > 0;
        Map<String, List<Reason>> picked = new LinkedHashMap<>();

        addGoal(picked, facts.goal(), facts.debtsWithRate(), income, fixedAboveHalf);
        if (income && facts.variableIncome()) {
            add(picked, "INCOME_CYCLE", new Reason("VARIABLE_INCOME", Map.of()));
        }
        if (fixedAboveHalf) {
            Reason reason = new Reason("FIXED_ABOVE_HALF_OF_INCOME", Map.of("fixedSharePercent", facts.fixedSharePercent(),
                    "fixedMonthly", facts.fixedMonthly(), "monthlyIncome", facts.confirmedIncome()));
            add(picked, "PRIORITIES", reason);
            add(picked, "INCOME_CYCLE", reason);
        }
        if (facts.debtsWithRate() >= 2) {
            Reason reason = new Reason("DEBTS_WITH_RATE", Map.of("debts", BigDecimal.valueOf(facts.debtsWithRate())));
            add(picked, "DEBT_AVALANCHE", reason);
            add(picked, "DEBT_SNOWBALL", reason);
        }
        if (facts.preference() == Preference.SIMPLE && income) {
            Reason reason = new Reason("PREFERS_SIMPLE", Map.of());
            add(picked, "PERCENT_503020", reason);
            add(picked, "PERCENT_BALANCED", reason);
        }
        if (facts.preference() == Preference.DETAILED) {
            Reason reason = new Reason("PREFERS_DETAIL", Map.of());
            if (income) add(picked, "ZERO_BASED", reason);
            add(picked, "ENVELOPES", reason);
        }
        if (picked.size() < 2) {
            if (income) {
                fill(picked, "PAY_YOURSELF_FIRST", new Reason("CONFIRMED_INCOME_KNOWN",
                        Map.of("monthlyIncome", facts.confirmedIncome())));
                fill(picked, "INCOME_CYCLE", new Reason("DAILY_LIMIT_UNTIL_NEXT_INCOME", Map.of()));
            } else {
                Reason reason = new Reason("NO_CONFIRMED_INCOME", Map.of());
                fill(picked, "PRIORITIES", reason);
                fill(picked, "ENVELOPES", reason);
            }
        }
        List<Suggestion> suggestions = new ArrayList<>();
        picked.forEach((method, reasons) -> suggestions.add(new Suggestion(method, List.copyOf(reasons))));
        return new Advice(!income, List.copyOf(suggestions));
    }

    /** The goal rules: what the person said comes before what the data suggests. */
    private static void addGoal(Map<String, List<Reason>> picked, Goal goal, int debts, boolean income,
                                boolean fixedAboveHalf) {
        Reason reason = new Reason("GOAL_" + goal.name(), Map.of());
        switch (goal) {
            case LEAVE_DEBT -> {
                if (debts == 0) {
                    add(picked, "PRIORITIES", new Reason("GOAL_LEAVE_DEBT_NO_DEBT_DATA", Map.of()));
                } else {
                    add(picked, "DEBT_AVALANCHE", reason);
                    if (debts >= 2) add(picked, "DEBT_SNOWBALL", reason);
                }
            }
            case BUILD_RESERVE -> {
                if (income) {
                    add(picked, "PAY_YOURSELF_FIRST", reason);
                    if (!fixedAboveHalf) add(picked, "PERCENT_BALANCED", reason);
                } else add(picked, "ENVELOPES", reason);
            }
            case ORGANIZE_MONTH -> {
                if (income) add(picked, "INCOME_CYCLE", reason);
                add(picked, "ENVELOPES", reason);
            }
            case STABILITY -> add(picked, income ? "INCOME_CYCLE" : "PRIORITIES", reason);
            case OTHER, NOT_SAID -> {
                // Nothing declared that a rule can read.
            }
        }
    }

    /** A confirmed income that changes in value or in day, as the recurrence detector saw it. */
    public static boolean variableIncome(List<ConfirmedRecurrence> confirmed) {
        return MonthPlanCalculator.incomes(confirmed).stream()
                .anyMatch(item -> !item.pattern().fixedAmount() || item.pattern().confidence() == Confidence.MEDIUM);
    }

    /** Adds the reason to a method already picked, or picks the method while there is room. */
    private static void add(Map<String, List<Reason>> picked, String method, Reason reason) {
        if (picked.containsKey(method)) picked.get(method).add(reason);
        else if (picked.size() < MAX) picked.put(method, new ArrayList<>(List.of(reason)));
    }

    /** Fallback: only methods not picked yet, only up to two. */
    private static void fill(Map<String, List<Reason>> picked, String method, Reason reason) {
        if (picked.size() < 2 && !picked.containsKey(method)) picked.put(method, new ArrayList<>(List.of(reason)));
    }
}
