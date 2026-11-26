package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEventPlanner.ConfirmedRecurrence;
import com.github.yildizmy.service.future.MonthPlanCalculator.Commitment;
import com.github.yildizmy.service.future.MonthPlanCalculator.Kind;
import com.github.yildizmy.service.future.MonthPlanCalculator.Slice;
import com.github.yildizmy.service.future.RecurrenceDetector.Category;
import com.github.yildizmy.service.future.RecurrenceDetector.Confidence;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Occurrence;
import com.github.yildizmy.service.future.RecurrenceDetector.RecurrencePattern;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Plano do mês (ADR 0021): slices, rounding, commitments and the dates they leave the balance. */
class MonthPlanCalculatorTest {

    private static BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    private static Slice slice(Kind kind, String percent, boolean commitment) {
        return new Slice(kind, kind.name(), money(percent), commitment);
    }

    /** André's split with the four slices he wanted committed actually marked. */
    private static List<Slice> andreCommitted() {
        return MonthPlanCalculator.PRESET_BALANCED.stream()
                .map(item -> new Slice(item.kind(), item.label(), item.percent(), item.kind().committable()))
                .toList();
    }

    static ConfirmedRecurrence recurrence(String key, Direction direction, String amount, int day, Category category,
                                          String lastSeen) {
        return recurrence(key, direction, amount, day, category, lastSeen, true, Confidence.HIGH);
    }

    static ConfirmedRecurrence recurrence(String key, Direction direction, String amount, int day, Category category,
                                          String lastSeen, boolean fixedAmount, Confidence confidence) {
        RecurrencePattern pattern = new RecurrencePattern(key, key, key, direction, "Conta", "Banco", money(amount),
                fixedAmount, day, confidence, category,
                List.of(new Occurrence(1, LocalDate.parse(lastSeen), money(amount))));
        return new ConfirmedRecurrence(pattern, category);
    }

    @Test
    void andresPresetIsTheSplitHeProposedAddsUpTo100AndCommitsNothingByItself() {
        assertEquals(List.of("35.00", "20.00", "15.00", "7.50", "10.00", "12.50"),
                MonthPlanCalculator.PRESET_BALANCED.stream().map(item -> item.percent().toPlainString()).toList());
        assertTrue(MonthPlanCalculator.complete(MonthPlanCalculator.PRESET_BALANCED));
        assertTrue(MonthPlanCalculator.complete(MonthPlanCalculator.PRESET_503020));
        assertTrue(MonthPlanCalculator.PRESET_BALANCED.stream().noneMatch(Slice::commitment));
        assertNull(MonthPlanCalculator.validate(MonthPlanCalculator.PRESET_BALANCED));
    }

    @Test
    void aDraftThatDoesNotAddUpTo100CanBeSavedButIsIncomplete() {
        List<Slice> draft = List.of(slice(Kind.FIXED, "35", false), slice(Kind.LEISURE, "20", false));
        assertNull(MonthPlanCalculator.validate(draft));
        assertFalse(MonthPlanCalculator.complete(draft));
        assertEquals(money("55"), MonthPlanCalculator.total(draft));
    }

    @Test
    void eachRuleOfASliceHasItsOwnCode() {
        assertEquals("MONTH_PLAN_EMPTY", MonthPlanCalculator.validate(List.of()));
        List<Slice> thirteen = new ArrayList<>();
        for (int i = 0; i < 13; i++) thirteen.add(new Slice(Kind.CUSTOM, "Fatia " + i, money("1"), false));
        assertEquals("MONTH_PLAN_TOO_MANY_SLICES", MonthPlanCalculator.validate(thirteen));
        assertNull(MonthPlanCalculator.validate(thirteen.subList(0, 12)), "twelve custom slices are allowed");
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(List.of(slice(Kind.CUSTOM, "-1", false))));
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(List.of(slice(Kind.CUSTOM, "100.01", false))));
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(List.of(slice(Kind.CUSTOM, "7.501", false))));
        assertEquals("MONTH_PLAN_INVALID_LABEL", MonthPlanCalculator.validate(List.of(new Slice(Kind.CUSTOM, " ", money("1"), false))));
        assertEquals("MONTH_PLAN_INVALID_LABEL", MonthPlanCalculator.validate(
                List.of(new Slice(Kind.CUSTOM, "x".repeat(41), money("1"), false))));
        assertEquals("MONTH_PLAN_SLICE_NOT_COMMITTABLE", MonthPlanCalculator.validate(List.of(slice(Kind.FIXED, "35", true))));
        assertEquals("MONTH_PLAN_SLICE_NOT_COMMITTABLE", MonthPlanCalculator.validate(List.of(slice(Kind.LEISURE, "20", true))));
        assertEquals("MONTH_PLAN_DUPLICATE_SLICE", MonthPlanCalculator.validate(
                List.of(slice(Kind.FUTURE, "10", false), slice(Kind.FUTURE, "10", false))));
    }

    @Test
    void theBaseIsOnlyConfirmedIncomeAndTheMainOneIsTheLargestSalary() {
        var salary = recurrence("in:empresa", Direction.IN, "4000.00", 5, Category.SALARY, "2026-11-05");
        var freela = recurrence("in:freela", Direction.IN, "6000.00", 20, Category.OTHER_INCOME, "2026-11-20");
        var rent = recurrence("out:aluguel", Direction.OUT, "1500.00", 10, Category.RENT, "2026-11-10");

        var income = MonthPlanCalculator.income(List.of(rent, freela, salary)).orElseThrow();

        assertEquals(money("10000.00"), income.monthly());
        assertEquals("in:empresa", income.main().pattern().key(), "a salary wins over a larger other income");
        assertEquals(2, income.sources().size());
        assertTrue(MonthPlanCalculator.income(List.of(rent)).isEmpty(), "no confirmed income: the plan has no base");
    }

    @Test
    void withoutASalaryTheLargestOtherIncomeSetsTheDay() {
        var small = recurrence("in:aluguel-recebido", Direction.IN, "800.00", 12, Category.OTHER_INCOME, "2026-11-12");
        var large = recurrence("in:cliente", Direction.IN, "3000.00", 3, Category.OTHER_INCOME, "2026-11-03");

        assertEquals("in:cliente", MonthPlanCalculator.income(List.of(small, large)).orElseThrow().main().pattern().key());
    }

    @Test
    void aCompletePlanAddsUpToTheBaseToTheCentAndTheResidualGoesToTheLargestSlice() {
        List<Slice> thirds = List.of(slice(Kind.CUSTOM, "33.33", false), slice(Kind.CUSTOM, "33.34", false),
                slice(Kind.CUSTOM, "33.33", false));

        List<BigDecimal> amounts = MonthPlanCalculator.amounts(money("1000.01"), thirds);

        // 333.303 -> 333.30, 333.403 -> 333.40, 333.303 -> 333.30: one cent short, given to the 33.34% slice.
        assertEquals(List.of(money("333.30"), money("333.41"), money("333.30")), amounts);
        assertEquals(money("1000.01"), amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Test
    void roundingIsHalfEvenAndTheFirstLargestSliceTakesTheResidualOnATie() {
        List<Slice> halves = List.of(slice(Kind.CUSTOM, "50", false), slice(Kind.CUSTOM, "50", false));

        // 0.05 x 50% = 0.025 -> 0.02 (half-even) twice = 0.04; the missing cent goes to the first slice.
        assertEquals(List.of(money("0.03"), money("0.02")), MonthPlanCalculator.amounts(money("0.05"), halves));
    }

    @Test
    void anIncompleteDraftKeepsPlainRoundingWithoutResidual() {
        List<Slice> draft = List.of(slice(Kind.CUSTOM, "33.33", false));

        assertEquals(List.of(money("333.30")), MonthPlanCalculator.amounts(money("1000.01"), draft));
    }

    @Test
    void andresSplitOn5000IsExactlyTheExpectedSlices() {
        assertEquals(List.of(money("1750.00"), money("1000.00"), money("750.00"), money("375.00"), money("500.00"),
                money("625.00")), MonthPlanCalculator.amounts(money("5000.00"), MonthPlanCalculator.PRESET_BALANCED));
    }

    @Test
    void onlyMarkedSlicesBecomeCommitmentsAndGoalsLiveInsideFuture() {
        List<Slice> slices = new ArrayList<>(andreCommitted());
        slices.set(5, new Slice(Kind.EMERGENCY, "Reserva", money("12.50"), false)); // the person left it unmarked

        List<Commitment> commitments = MonthPlanCalculator.commitments(money("5000.00"), slices, money("100.00"));

        assertEquals(List.of(Kind.INVESTMENT, Kind.FUTURE, Kind.DEVELOPMENT), commitments.stream().map(Commitment::kind).toList());
        assertEquals(money("750.00"), commitments.get(0).amount());
        assertEquals(money("275.00"), commitments.get(1).amount(), "375 of the slice minus 100 the goals already set aside");
        assertEquals(money("1525.00"), MonthPlanCalculator.sum(commitments));
    }

    @Test
    void goalsLargerThanTheFutureSliceNeverMakeANegativeCommitment() {
        List<Commitment> commitments = MonthPlanCalculator.commitments(money("5000.00"), andreCommitted(), money("900.00"));

        assertEquals(money("0.00"), commitments.get(1).amount());
    }

    @Test
    void commitmentsLeaveOnTheDayTheMainIncomeArrivesAndAreConfirmed() {
        var salary = recurrence("in:empresa", Direction.IN, "5000.00", 5, Category.SALARY, "2026-11-05");
        List<Commitment> commitments = MonthPlanCalculator.commitments(money("5000.00"), andreCommitted(), BigDecimal.ZERO);

        List<CashEvent> events = MonthPlanCalculator.events(commitments, salary, LocalDate.parse("2026-11-23"),
                LocalDate.parse("2027-01-31"));

        // 05/12/2026 is a Saturday: the salary arrives on Friday 04/12, and so does the plan. 05/01/2027 is a Tuesday.
        assertEquals(List.of(LocalDate.parse("2026-12-04"), LocalDate.parse("2027-01-05")),
                events.stream().map(CashEvent::date).distinct().toList());
        assertEquals(8, events.size());
        CashEvent investment = events.get(0);
        assertEquals(money("-750.00"), investment.amount());
        assertEquals("Plano do mês: Investimento", investment.label());
        assertEquals(CashEvent.Kind.PLAN, investment.kind());
        assertEquals("PLAN_INVESTMENT", investment.category());
        assertEquals(CashEvent.Certainty.CONFIRMED, investment.certainty());
        assertEquals("Plano do mês", investment.origin());
        assertEquals("plan:2", investment.reference());
        assertEquals(LocalDate.parse("2026-12-04"), MonthPlanCalculator.nextDate(salary, LocalDate.parse("2026-11-23")).orElseThrow());
    }

    @Test
    void aPlanWithNothingMarkedOrAZeroCommitmentCreatesNoEvent() {
        var salary = recurrence("in:empresa", Direction.IN, "5000.00", 5, Category.SALARY, "2026-11-05");
        LocalDate today = LocalDate.parse("2026-11-23");
        LocalDate end = LocalDate.parse("2027-01-31");

        assertTrue(MonthPlanCalculator.events(MonthPlanCalculator.commitments(money("5000.00"),
                MonthPlanCalculator.PRESET_BALANCED, BigDecimal.ZERO), salary, today, end).isEmpty());
        assertTrue(MonthPlanCalculator.events(MonthPlanCalculator.commitments(money("5000.00"),
                List.of(slice(Kind.FIXED, "100", false), slice(Kind.EMERGENCY, "0", true)), BigDecimal.ZERO),
                salary, today, end).isEmpty());
    }

    @Test
    void theFixedThermometerSumsConfirmedRentBillsSubscriptionsAndLoanInstalments() {
        var rent = recurrence("out:aluguel", Direction.OUT, "1500.00", 10, Category.RENT, "2026-11-10");
        var power = recurrence("out:luz", Direction.OUT, "200.00", 15, Category.BILL, "2026-11-15");
        var streaming = recurrence("out:stream", Direction.OUT, "40.00", 20, Category.SUBSCRIPTION, "2026-11-20");
        var other = recurrence("out:academia", Direction.OUT, "120.00", 8, Category.OTHER, "2026-11-08");
        var salary = recurrence("in:empresa", Direction.IN, "5000.00", 5, Category.SALARY, "2026-11-05");
        var loan = new LoanPlan(1, "Crédito pessoal", "Banco", money("3000.00"), money("300.00"), 12, 4,
                LocalDate.parse("2026-12-10"), 10);
        var paidOff = new LoanPlan(2, "Consignado", "Banco", money("0.00"), money("500.00"), 12, 12, null, 10);

        var used = MonthPlanCalculator.fixedUsed(List.of(rent, power, streaming, other, salary), List.of(loan, paidOff));

        assertEquals(money("1740.00"), used.recurring());
        assertEquals(money("300.00"), used.loans());
        assertEquals(money("2040.00"), used.total());
    }

    @Test
    void usedPercentIsOneDecimalAndUnknownWhenTheSliceIsZero() {
        assertEquals(money("116.6"), MonthPlanCalculator.usedPercent(money("2040.00"), money("1750.00")));
        assertNull(MonthPlanCalculator.usedPercent(money("10.00"), money("0.00")));
    }
}
