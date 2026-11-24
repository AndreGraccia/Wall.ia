package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEventPlanner.ConfirmedRecurrence;
import com.github.yildizmy.service.future.MonthPlanCalculator.Slice;
import com.github.yildizmy.service.future.MonthPlanCalculator.Split;
import com.github.yildizmy.service.future.RecurrenceDetector.Category;
import com.github.yildizmy.service.future.RecurrenceDetector.Confidence;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Occurrence;
import com.github.yildizmy.service.future.RecurrenceDetector.RecurrencePattern;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Plano do mês (ADR 0021): the split, the base, the commitments and the dates they leave the balance. */
class MonthPlanCalculatorTest {

    private static BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    private static Split split(String fixed, String leisure, String investment, String future, String development,
                               String emergency) {
        return new Split(money(fixed), money(leisure), money(investment), money(future), money(development), money(emergency));
    }

    static ConfirmedRecurrence recurrence(String key, Direction direction, String amount, int day, Category category,
                                          String lastSeen) {
        RecurrencePattern pattern = new RecurrencePattern(key, key, key, direction, "Conta", "Banco", money(amount), true,
                day, Confidence.HIGH, category, List.of(new Occurrence(1, LocalDate.parse(lastSeen), money(amount))));
        return new ConfirmedRecurrence(pattern, category);
    }

    @Test
    void theSuggestedSplitIsTheOneTheOwnerAskedForAndAddsUpTo100() {
        Split suggested = MonthPlanCalculator.SUGGESTED;
        assertEquals(0, suggested.fixed().compareTo(money("35")));
        assertEquals(0, suggested.leisure().compareTo(money("20")));
        assertEquals(0, suggested.investment().compareTo(money("15")));
        assertEquals(0, suggested.future().compareTo(money("7.5")));
        assertEquals(0, suggested.development().compareTo(money("10")));
        assertEquals(0, suggested.emergency().compareTo(money("12.5")));
        assertNull(MonthPlanCalculator.validate(suggested));
    }

    @Test
    void aSplitMustAddUpToExactly100AndEachSliceStayBetween0And100() {
        assertEquals("MONTH_PLAN_SUM_NOT_100", MonthPlanCalculator.validate(split("35", "20", "15", "7.5", "10", "12.49")));
        assertEquals("MONTH_PLAN_SUM_NOT_100", MonthPlanCalculator.validate(split("35", "20", "15", "7.5", "10", "12.51")));
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(split("-1", "21", "15", "7.5", "10", "12.5")));
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(split("100.01", "0", "0", "0", "0", "0")));
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(split("35.001", "20", "15", "7.5", "10", "12.499")));
        assertEquals("MONTH_PLAN_INVALID_PERCENT", MonthPlanCalculator.validate(
                new Split(null, money("20"), money("15"), money("7.5"), money("10"), money("47.5"))));
        assertNull(MonthPlanCalculator.validate(split("100", "0", "0", "0", "0", "0")), "everything fixed is a valid choice");
    }

    @Test
    void theBaseIsOnlyConfirmedIncomeAndTheMainOneIsTheLargestSalary() {
        var salary = recurrence("in:empresa", Direction.IN, "4000.00", 5, Category.SALARY, "2026-11-05");
        var freela = recurrence("in:freela", Direction.IN, "1000.00", 20, Category.OTHER_INCOME, "2026-11-20");
        var rent = recurrence("out:aluguel", Direction.OUT, "1500.00", 10, Category.RENT, "2026-11-10");

        var income = MonthPlanCalculator.income(List.of(rent, freela, salary)).orElseThrow();

        assertEquals(money("5000.00"), income.monthly());
        assertEquals("in:empresa", income.main().pattern().key());
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
    void eachSliceIsTheBaseTimesItsPercentInCents() {
        assertEquals(money("375.00"), MonthPlanCalculator.amount(money("5000.00"), money("7.5")));
        assertEquals(money("0.33"), MonthPlanCalculator.amount(money("3.33"), money("10")));
    }

    @Test
    void onlyInvestmentFutureDevelopmentAndEmergencyBecomeCommitmentsAndGoalsLiveInsideFuture() {
        Map<Slice, BigDecimal> commitments = MonthPlanCalculator.commitments(money("5000.00"), MonthPlanCalculator.SUGGESTED,
                money("100.00"));

        assertEquals(List.of(Slice.INVESTMENT, Slice.FUTURE, Slice.DEVELOPMENT, Slice.EMERGENCY), List.copyOf(commitments.keySet()));
        assertEquals(money("750.00"), commitments.get(Slice.INVESTMENT));
        assertEquals(money("275.00"), commitments.get(Slice.FUTURE), "375 of the slice minus 100 the goals already set aside");
        assertEquals(money("500.00"), commitments.get(Slice.DEVELOPMENT));
        assertEquals(money("625.00"), commitments.get(Slice.EMERGENCY));
    }

    @Test
    void goalsLargerThanTheFutureSliceNeverMakeANegativeCommitment() {
        Map<Slice, BigDecimal> commitments = MonthPlanCalculator.commitments(money("5000.00"), MonthPlanCalculator.SUGGESTED,
                money("900.00"));

        assertEquals(money("0.00"), commitments.get(Slice.FUTURE));
    }

    @Test
    void commitmentsLeaveOnTheDayTheMainIncomeArrivesAndAreConfirmed() {
        var salary = recurrence("in:empresa", Direction.IN, "5000.00", 5, Category.SALARY, "2026-11-05");
        Map<Slice, BigDecimal> commitments = MonthPlanCalculator.commitments(money("5000.00"), MonthPlanCalculator.SUGGESTED,
                BigDecimal.ZERO);

        List<CashEvent> events = MonthPlanCalculator.events(commitments, salary, LocalDate.parse("2026-11-23"),
                LocalDate.parse("2027-01-31"));

        // 05/12/2026 is a Saturday: the salary arrives on Friday 04/12, and so does the plan. 05/01/2027 is a Tuesday.
        assertEquals(List.of(LocalDate.parse("2026-12-04"), LocalDate.parse("2027-01-05")),
                events.stream().map(CashEvent::date).distinct().toList());
        assertEquals(8, events.size());
        CashEvent investment = events.get(0);
        assertEquals(money("-750.00"), investment.amount());
        assertEquals(CashEvent.Kind.PLAN, investment.kind());
        assertEquals("PLAN_INVESTMENT", investment.category());
        assertEquals(CashEvent.Certainty.CONFIRMED, investment.certainty());
        assertEquals("Plano do mês", investment.origin());
        assertEquals("plan:INVESTMENT", investment.reference());
    }

    @Test
    void aZeroCommitmentCreatesNoEvent() {
        var salary = recurrence("in:empresa", Direction.IN, "5000.00", 5, Category.SALARY, "2026-11-05");
        Map<Slice, BigDecimal> commitments = MonthPlanCalculator.commitments(money("5000.00"),
                split("50", "50", "0", "0", "0", "0"), BigDecimal.ZERO);

        assertTrue(MonthPlanCalculator.events(commitments, salary, LocalDate.parse("2026-11-23"),
                LocalDate.parse("2027-01-31")).isEmpty());
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
