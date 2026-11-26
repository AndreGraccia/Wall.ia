package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.MethodAdvisor.Advice;
import com.github.yildizmy.service.future.MethodAdvisor.Facts;
import com.github.yildizmy.service.future.MethodAdvisor.Preference;
import com.github.yildizmy.service.future.MethodAdvisor.Suggestion;
import com.github.yildizmy.service.future.RecurrenceDetector.Category;
import com.github.yildizmy.service.future.RecurrenceDetector.Confidence;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** "Meu método" (ADR 0021): one test per eligibility rule. No score anywhere; each suggestion says why. */
class MethodAdvisorTest {

    private static final Set<String> PERCENT = Set.of("PERCENT_503020", "PERCENT_BALANCED", "ZERO_BASED");

    private static Facts facts(String income, boolean variable, String fixed, int debts, Preference preference) {
        return new Facts(income == null ? null : new BigDecimal(income), variable, new BigDecimal(fixed), debts, preference);
    }

    private static List<String> methods(Advice advice) {
        return advice.suggestions().stream().map(Suggestion::method).toList();
    }

    private static Suggestion find(Advice advice, String method) {
        return advice.suggestions().stream().filter(item -> item.method().equals(method)).findFirst().orElseThrow();
    }

    @Test
    void fixedBillsAboveHalfTheIncomeSuggestPrioritiesAndTheIncomeCycleBeforeAnyPercent() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", false, "2400.00", 0, Preference.SIMPLE));

        assertEquals(List.of("PRIORITIES", "INCOME_CYCLE", "PERCENT_503020"), methods(advice));
        var reason = find(advice, "PRIORITIES").reasons().get(0);
        assertEquals("FIXED_ABOVE_HALF_OF_INCOME", reason.code());
        assertEquals(new BigDecimal("60.0"), reason.params().get("fixedSharePercent"));
    }

    @Test
    void fixedBillsAtExactlyHalfDoNotTriggerTheRule() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", false, "2000.00", 0, Preference.NOT_SAID));

        assertFalse(methods(advice).contains("PRIORITIES"));
    }

    @Test
    void variableIncomePutsTheIncomeCycleFirst() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", true, "1000.00", 0, Preference.SIMPLE));

        assertEquals("INCOME_CYCLE", methods(advice).get(0));
        assertEquals("VARIABLE_INCOME", find(advice, "INCOME_CYCLE").reasons().get(0).code());
    }

    @Test
    void twoOrMoreDebtsWithRateSuggestAvalancheAndSnowball() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", false, "1000.00", 2, Preference.NOT_SAID));

        assertEquals(List.of("DEBT_AVALANCHE", "DEBT_SNOWBALL"), methods(advice).subList(0, 2));
        assertEquals(new BigDecimal("2"), find(advice, "DEBT_AVALANCHE").reasons().get(0).params().get("debts"));
        assertFalse(methods(MethodAdvisor.suggest(facts("4000.00", false, "1000.00", 1, Preference.NOT_SAID)))
                .contains("DEBT_AVALANCHE"), "one debt has no order to choose");
    }

    @Test
    void preferringSimplicitySuggestsThePercentPresets() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", false, "1000.00", 0, Preference.SIMPLE));

        assertEquals(List.of("PERCENT_503020", "PERCENT_BALANCED"), methods(advice));
        assertEquals("PREFERS_SIMPLE", find(advice, "PERCENT_BALANCED").reasons().get(0).code());
    }

    @Test
    void preferringDetailSuggestsZeroBasedAndEnvelopes() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", false, "1000.00", 0, Preference.DETAILED));

        assertEquals(List.of("ZERO_BASED", "ENVELOPES"), methods(advice));
    }

    @Test
    void withoutConfirmedIncomeNoPercentMethodIsSuggestedAndTheIncomeIsAskedFor() {
        Advice advice = MethodAdvisor.suggest(facts(null, false, "1000.00", 0, Preference.SIMPLE));

        assertTrue(advice.needsConfirmedIncome());
        assertTrue(methods(advice).stream().noneMatch(PERCENT::contains), methods(advice).toString());
        assertTrue(methods(advice).size() >= 2);
        assertEquals("NO_CONFIRMED_INCOME", advice.suggestions().get(0).reasons().get(0).code());
    }

    @Test
    void withoutAnyRuleTheDefaultsStillExplainThemselves() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", false, "1000.00", 0, Preference.NOT_SAID));

        assertEquals(List.of("PAY_YOURSELF_FIRST", "INCOME_CYCLE"), methods(advice));
        assertEquals("CONFIRMED_INCOME_KNOWN", find(advice, "PAY_YOURSELF_FIRST").reasons().get(0).code());
        assertEquals(new BigDecimal("4000.00"), find(advice, "PAY_YOURSELF_FIRST").reasons().get(0).params().get("monthlyIncome"));
    }

    @Test
    void neverMoreThanThreeAndAMethodHitByTwoRulesKeepsBothReasons() {
        Advice advice = MethodAdvisor.suggest(facts("4000.00", true, "2400.00", 3, Preference.DETAILED));

        assertEquals(List.of("INCOME_CYCLE", "PRIORITIES", "DEBT_AVALANCHE"), methods(advice));
        assertEquals(List.of("VARIABLE_INCOME", "FIXED_ABOVE_HALF_OF_INCOME"),
                find(advice, "INCOME_CYCLE").reasons().stream().map(MethodAdvisor.Reason::code).toList());
    }

    @Test
    void everySuggestedMethodIsInTheCatalog() {
        for (Preference preference : Preference.values()) {
            for (String income : new String[]{null, "4000.00"}) {
                MethodAdvisor.suggest(facts(income, true, "3000.00", 2, preference)).suggestions()
                        .forEach(item -> assertTrue(MethodCatalog.find(item.method()).isPresent(), item.method()));
            }
        }
    }

    @Test
    void incomeIsVariableWhenAConfirmedIncomeChangesInValueOrInDay() {
        var steady = MonthPlanCalculatorTest.recurrence("in:empresa", Direction.IN, "4000.00", 5, Category.SALARY,
                "2026-11-05", true, Confidence.HIGH);
        var changing = MonthPlanCalculatorTest.recurrence("in:cliente", Direction.IN, "900.00", 12, Category.OTHER_INCOME,
                "2026-11-12", false, Confidence.HIGH);
        var irregularDay = MonthPlanCalculatorTest.recurrence("in:bico", Direction.IN, "500.00", 20, Category.OTHER_INCOME,
                "2026-11-20", true, Confidence.MEDIUM);
        var bill = MonthPlanCalculatorTest.recurrence("out:luz", Direction.OUT, "200.00", 10, Category.BILL,
                "2026-11-10", false, Confidence.MEDIUM);

        assertFalse(MethodAdvisor.variableIncome(List.of(steady, bill)), "a bill that varies says nothing about income");
        assertTrue(MethodAdvisor.variableIncome(List.of(steady, changing)));
        assertTrue(MethodAdvisor.variableIncome(List.of(steady, irregularDay)));
    }
}
