package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEvent.Kind;
import com.github.yildizmy.service.future.ScenarioSimulator.Method;
import com.github.yildizmy.service.future.ScenarioSimulator.Scenario;
import com.github.yildizmy.service.future.ScenarioSimulator.Type;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CardAndScenarioTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 22);
    // Closes on the 25th, due on the 3rd of the following month.
    private static final CardPlan CARD = new CardPlan(1, "Aurora Card · final 4821", "Banco Aurora", 25, 3, List.of(
            new CardPlan.Charge(1, "Smart TV", LocalDate.of(2026, 7, 14), new BigDecimal("3299.00"),
                    new BigDecimal("329.90"), 10, YearMonth.of(2026, 8)),
            new CardPlan.Charge(2, "Spotify", LocalDate.of(2026, 9, 9), new BigDecimal("21.90"),
                    new BigDecimal("21.90"), 1, YearMonth.of(2026, 10))
    ));

    @Test
    void instalmentsAddUpToThePurchaseTheFirstOneCarriesTheLeftoverCents() {
        // R$ 100,00 in 3: the import stores 33.33 per instalment, which alone would add up to 99.99.
        CardPlan card = new CardPlan(2, "Card", "Bank", 25, 3, List.of(new CardPlan.Charge(1, "Headphones",
                LocalDate.of(2026, 9, 10), new BigDecimal("100.00"), new BigDecimal("33.33"), 3, YearMonth.of(2026, 10))));

        assertEquals(new BigDecimal("33.34"), card.invoiceTotal(YearMonth.of(2026, 10)));
        assertEquals(new BigDecimal("33.33"), card.invoiceTotal(YearMonth.of(2026, 11)));
        assertEquals(new BigDecimal("100.00"), card.invoiceTotal(YearMonth.of(2026, 10))
                .add(card.invoiceTotal(YearMonth.of(2026, 11))).add(card.invoiceTotal(YearMonth.of(2026, 12))));
    }

    @Test
    void purchaseBeforeClosingGoesToNextMonthsBillAndAfterClosingSkipsOne() {
        assertEquals(YearMonth.of(2026, 10), CARD.invoiceFor(LocalDate.of(2026, 9, 24)));
        assertEquals(YearMonth.of(2026, 11), CARD.invoiceFor(LocalDate.of(2026, 9, 25)), "closing day already belongs to the next bill");
        assertEquals(LocalDate.of(2026, 10, 3), CARD.dueDate(YearMonth.of(2026, 10)));
    }

    @Test
    void invoiceIsRebuiltFromChargesWithInstalmentNumbers() {
        var lines = CARD.invoiceLines(YearMonth.of(2026, 10));

        assertEquals(new BigDecimal("351.80"), CARD.invoiceTotal(YearMonth.of(2026, 10)));
        assertEquals(3, lines.stream().filter(line -> line.charge().id() == 1).findFirst().orElseThrow().installment(),
                "TV started in August: October carries instalment 3/10");
        assertEquals(BigDecimal.ZERO, CARD.invoiceTotal(YearMonth.of(2027, 6)), "10 instalments end in May 2027");
    }

    @Test
    // 03/10/2026 is a Saturday: the invoice is paid on Monday, 05/10.
    void cardInvoicesBecomeConfirmedEventsOnDueDates() {
        var events = CashEventPlanner.fromCard(CARD, TODAY, TODAY.plusDays(90));

        assertEquals(List.of(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 11, 3), LocalDate.of(2026, 12, 3)),
                events.stream().map(CashEvent::date).toList());
        assertTrue(events.stream().allMatch(event -> event.certainty() == CashEvent.Certainty.CONFIRMED));
    }

    @Test
    void loanProjectsOnlyRemainingInstalmentsKeepingTheDueDay() {
        var loan = new LoanPlan(1, "Empréstimo pessoal", "Banco", new BigDecimal("5000"), new BigDecimal("612.48"),
                24, 22, LocalDate.of(2026, 1, 31), null);

        assertEquals(List.of(LocalDate.of(2026, 1, 31), LocalDate.of(2026, 2, 28)), loan.dueDates());
    }

    @Test
    void upcomingDueDateSkipsAnInstalmentAlreadyDue() {
        // The bank still reports 25/11 on 26/11: the payment was not seen yet, the next one is 25/12.
        var loan = new LoanPlan(1, "Empréstimo pessoal", "Banco", new BigDecimal("5000"), new BigDecimal("612.48"),
                24, 9, LocalDate.of(2026, 11, 25), 25);

        assertEquals(LocalDate.of(2026, 12, 25), loan.upcomingDueDate(LocalDate.of(2026, 11, 26)));
        assertEquals(LocalDate.of(2026, 11, 25), loan.upcomingDueDate(LocalDate.of(2026, 11, 25)));
    }

    @Test
    void paidOffLoanHasNoUpcomingDueDate() {
        var loan = new LoanPlan(1, "Empréstimo pessoal", "Banco", new BigDecimal("0"), new BigDecimal("612.48"),
                24, 24, LocalDate.of(2026, 11, 25), 25);

        assertNull(loan.upcomingDueDate(LocalDate.of(2026, 11, 26)));
    }

    @Test
    void contractualDueDaySurvivesAShortMonth() {
        var loan = new LoanPlan(1, "Empréstimo pessoal", "Banco", new BigDecimal("5000"), new BigDecimal("612.48"),
                24, 21, LocalDate.of(2027, 2, 28), 31);

        assertEquals(List.of(LocalDate.of(2027, 2, 28), LocalDate.of(2027, 3, 31), LocalDate.of(2027, 4, 30)),
                loan.dueDates());
    }

    @Test
    void instalmentPurchaseOnCardAddsTheInstalmentToEachFutureBill() {
        var outcome = ScenarioSimulator.apply(
                new Scenario(Type.PURCHASE, new BigDecimal("4000.00"), 10, Method.CARD, null, null, 1, null, "Notebook"),
                TODAY, TODAY.plusDays(90), List.of(), List.of(CARD));

        assertEquals(new BigDecimal("400.00"), outcome.newMonthlyCommitment());
        assertEquals(10, outcome.installments());
        assertEquals(LocalDate.of(2026, 10, 3), outcome.events().get(0).date(), "first instalment on the next bill");
        assertEquals("Notebook · 1/10", outcome.events().get(0).label());
        assertEquals(3, outcome.events().size(), "only bills inside the 90-day horizon");
    }

    @Test
    void cashPurchaseLeavesToday() {
        var outcome = ScenarioSimulator.apply(
                new Scenario(Type.PURCHASE, new BigDecimal("3000.00"), 1, Method.CASH, null, null, 1, null, null),
                TODAY, TODAY.plusDays(90), List.of(), List.of());

        assertEquals(TODAY, outcome.events().get(0).date());
        assertEquals(new BigDecimal("-3000.00"), outcome.events().get(0).amount());
        assertEquals(BigDecimal.ZERO, outcome.newMonthlyCommitment());
    }

    @Test
    void instalmentsAlwaysAddUpToTheExactAmount() {
        var parts = ScenarioSimulator.split(new BigDecimal("100.00"), 3);

        assertEquals(new BigDecimal("33.34"), parts.get(0));
        assertEquals(new BigDecimal("100.00"), parts.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    @Test
    void losingIncomeRemovesOnlyThatIncomeForTheChosenMonths() {
        var baseline = List.of(
                ProjectionEngineTest.in(LocalDate.of(2026, 10, 5), "4850.00", "in:concentrix-s-a"),
                ProjectionEngineTest.in(LocalDate.of(2026, 11, 5), "4850.00", "in:concentrix-s-a"),
                ProjectionEngineTest.in(LocalDate.of(2026, 10, 21), "650.00", "in:marina-souza"),
                ProjectionEngineTest.out(LocalDate.of(2026, 10, 1), "1500.00", "Aluguel")
        );

        var outcome = ScenarioSimulator.apply(
                new Scenario(Type.INCOME_LOSS, null, 1, Method.CASH, null, null, 1, "in:concentrix-s-a", null),
                TODAY, TODAY.plusDays(90), baseline, List.of());

        assertEquals(List.of("in:concentrix-s-a", "in:marina-souza", "Aluguel"),
                outcome.events().stream().map(CashEvent::reference).toList(), "October salary removed, November kept");
        assertTrue(outcome.events().stream().noneMatch(event -> event.kind() == Kind.SCENARIO));
    }

    @Test
    void monthlySavingIsAnOutflowEveryMonthInsideTheHorizon() {
        var outcome = ScenarioSimulator.apply(
                new Scenario(Type.SAVINGS, new BigDecimal("500.00"), 1, Method.CASH, null, 6, 1, null, null),
                TODAY, TODAY.plusDays(90), List.of(), List.of());

        assertEquals(List.of(LocalDate.of(2026, 10, 6), LocalDate.of(2026, 11, 6), LocalDate.of(2026, 12, 6)),
                outcome.events().stream().map(CashEvent::date).toList());
        assertEquals(new BigDecimal("500.00"), outcome.newMonthlyCommitment());
    }
}
