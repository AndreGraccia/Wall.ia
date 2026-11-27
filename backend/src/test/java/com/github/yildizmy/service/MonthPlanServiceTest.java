package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.MonthPlan;
import com.github.yildizmy.domain.entity.RecurrenceDecision;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Type;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.RecurrenceStatus;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import com.github.yildizmy.dto.response.PlanResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.ManualDebtRepository;
import com.github.yildizmy.repository.MonthPlanRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.future.MonthPlanCalculator;
import com.github.yildizmy.service.future.MonthPlanCalculator.Kind;
import com.github.yildizmy.service.future.MonthPlanCalculator.Slice;
import com.github.yildizmy.service.future.MonthlyProjection;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plano do mês, Entradas e saídas and Projeção mensal through the real FutureService (ADR 0021): a salary of 5000 on
 * the 5th and a rent of 1500 on the 10th, both confirmed, and one market purchase this month. Today is 23/11/2026.
 */
class MonthPlanServiceTest {

    private final WalletRepository wallets = mock(WalletRepository.class);
    private final TransactionRepository transactions = mock(TransactionRepository.class);
    private final RecurrenceDecisionRepository decisions = mock(RecurrenceDecisionRepository.class);
    private final MonthPlanRepository plans = mock(MonthPlanRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-23T15:00:00Z"), ZoneOffset.UTC);
    private final FutureService future = new FutureService(wallets, transactions, decisions,
            mock(CreditCardRepository.class), mock(LoanRepository.class), mock(GoalRepository.class),
            mock(EnvelopeRepository.class), mock(ManualDebtRepository.class), plans, mock(UserService.class),
            mock(com.github.yildizmy.service.market.MarketRatesService.class), clock);
    private final MonthPlanService service = new MonthPlanService(future, plans, mock(UserService.class), clock);
    private final Wallet account = new Wallet();
    private long ids = 1;
    private final List<Transaction> history = new ArrayList<>();

    MonthPlanServiceTest() {
        account.setId(1L);
        account.setName("Conta");
        account.setInstitutionName("Banco Aurora");
        account.setBalance(new BigDecimal("3000.00"));
        when(wallets.findByUserId(7L)).thenReturn(List.of(account));
        for (String month : List.of("2026-08", "2026-09", "2026-10", "2026-11")) {
            history.add(movement(4L, "Deposit", "5000.00", "Empresa X", month + "-05T13:00:00Z", "TED"));
            history.add(movement(5L, "Withdrawal", "1500.00", "Imobiliaria Lar", month + "-10T13:00:00Z", "BOLETO"));
        }
        history.add(movement(5L, "Withdrawal", "120.00", "Mercado Bom", "2026-11-12T13:00:00Z", "PIX"));
        when(transactions.findAllByUserIdSince(eq(7L), any())).thenReturn(history);
        when(plans.save(any(MonthPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Transaction movement(long typeId, String typeName, String amount, String description, String at, String paymentType) {
        Type type = new Type();
        type.setId(typeId);
        type.setName(typeName);
        Transaction transaction = new Transaction();
        transaction.setId(ids++);
        transaction.setType(type);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setDescription(description);
        transaction.setFromWallet(account);
        transaction.setToWallet(account);
        transaction.setCreatedAt(Instant.parse(at));
        transaction.setStatus(Status.SUCCESS);
        transaction.setSource(TransactionSource.OPEN_FINANCE);
        transaction.setPaymentType(paymentType);
        return transaction;
    }

    private void confirmIncomeAndRent() {
        when(decisions.findByUserId(7L)).thenReturn(List.of(decision("in:empresa-x", "SALARY"),
                decision("out:imobiliaria-lar", "RENT")));
    }

    private static RecurrenceDecision decision(String key, String category) {
        RecurrenceDecision decision = new RecurrenceDecision();
        decision.setPatternKey(key);
        decision.setStatus(RecurrenceStatus.CONFIRMED);
        decision.setCategory(category);
        decision.setDecidedAt(Instant.parse("2026-11-20T10:00:00Z"));
        return decision;
    }

    /** André's preset with investment and emergency reserve marked as commitments. */
    private static List<Slice> andre() {
        return MonthPlanCalculator.PRESET_BALANCED.stream()
                .map(item -> new Slice(item.kind(), item.label(), item.percent(),
                        item.kind() == Kind.INVESTMENT || item.kind() == Kind.EMERGENCY))
                .toList();
    }

    private MonthPlan stored(List<Slice> slices, boolean active) {
        MonthPlan plan = new MonthPlan();
        for (Slice slice : slices) {
            MonthPlan.Slice row = new MonthPlan.Slice();
            row.setKind(slice.kind().name());
            row.setLabel(slice.label());
            row.setPercent(slice.percent());
            row.setCommitment(slice.commitment());
            plan.getSlices().add(row);
        }
        plan.setActive(active);
        when(plans.findByUserId(7L)).thenReturn(Optional.of(plan));
        return plan;
    }

    private static String code(Runnable call) {
        return assertThrows(WalletRuleException.class, call::run).getMessage();
    }

    @Test
    void withoutConfirmedIncomeThePlanAsksForItAndShowsNoAmounts() {
        stored(andre(), false);

        PlanResponses.MonthPlan plan = service.view(7L);

        assertEquals("NEEDS_CONFIRMED_INCOME", plan.status());
        assertTrue(plan.warnings().contains("NEEDS_CONFIRMED_INCOME"));
        assertNull(plan.income());
        assertNull(plan.slices().get(0).amount());
        assertEquals("MONTH_PLAN_NEEDS_INCOME", code(() -> service.setActive(7L, true)));
        assertEquals("MONTH_PLAN_NEEDS_INCOME", code(() -> future.monthPlanFit(7L, andre())));
    }

    @Test
    void nothingSavedIsEmptyAndCannotBeActivated() {
        confirmIncomeAndRent();

        assertEquals("EMPTY", service.view(7L).status());
        assertEquals("MONTH_PLAN_EMPTY", code(() -> service.setActive(7L, true)));
    }

    @Test
    void anIncompleteDraftIsSavedWithAWarningButNeverActivated() {
        confirmIncomeAndRent();
        List<Slice> draft = List.of(new Slice(Kind.FIXED, "Fixo", new BigDecimal("35.00"), false));

        PlanResponses.MonthPlan saved = service.save(7L, draft);

        assertEquals("INCOMPLETE", saved.status());
        assertEquals(List.of("INCOMPLETE"), saved.warnings());
        assertFalse(saved.complete());
        assertEquals(0, saved.totalPercent().compareTo(new BigDecimal("35")));
        verify(plans).save(any(MonthPlan.class));

        stored(draft, false);
        assertEquals("MONTH_PLAN_INCOMPLETE", code(() -> service.setActive(7L, true)));
    }

    @Test
    void anActivePlanCannotBeSavedIncomplete() {
        confirmIncomeAndRent();
        stored(andre(), true);

        assertEquals("MONTH_PLAN_INCOMPLETE", code(() -> service.save(7L,
                List.of(new Slice(Kind.FIXED, "Fixo", new BigDecimal("35.00"), false)))));
        verify(plans, never()).save(any(MonthPlan.class));
    }

    @Test
    void theViewMeasuresFixedAndLeisureAndShowsWhatTheMarkedSlicesCommit() {
        history.add(movement(5L, "Withdrawal", "80.00", "Restaurante Sabor", "2026-11-14T13:00:00Z", "PIX"));
        history.add(movement(5L, "Withdrawal", "30.00", "Loja Aurora", "2026-11-15T13:00:00Z", "PIX"));
        confirmIncomeAndRent();
        stored(andre(), false);

        PlanResponses.MonthPlan plan = service.view(7L);

        assertEquals("DRAFT", plan.status());
        assertEquals(new BigDecimal("5000.00"), plan.income().monthly());
        assertEquals(java.time.LocalDate.parse("2026-12-04"), plan.income().nextDate());
        PlanResponses.Slice fixed = plan.slices().get(0);
        assertEquals("THERMOMETER", fixed.role());
        assertEquals(new BigDecimal("1750.00"), fixed.amount());
        assertEquals(new BigDecimal("1620.00"), fixed.used(), "1500 of rent plus 120 at the market");
        assertEquals(new BigDecimal("92.6"), fixed.usedPercent());
        assertEquals(new BigDecimal("120.00"), plan.fixed().essentials());
        assertEquals(new BigDecimal("30.00"), plan.unclassified(), "the unknown shop counts in no slice");
        PlanResponses.Slice leisure = plan.slices().get(1);
        assertEquals(new BigDecimal("80.00"), leisure.used(), "only the restaurant: the market is essential");
        assertEquals(new BigDecimal("920.00"), leisure.remaining());
        assertEquals("COMMITMENT", plan.slices().get(2).role());
        assertEquals(new BigDecimal("750.00"), plan.slices().get(2).committed());
        assertEquals("RESERVED", plan.slices().get(3).role(), "Future was not marked");
        assertNull(plan.slices().get(3).committed());
        assertEquals(BigDecimal.ZERO, plan.monthlyCommitment(), "not active: nothing leaves the balance");
    }

    @Test
    void theFitSavesNothingAndOnlyTheMarkedSlicesCount() {
        confirmIncomeAndRent();

        var result = future.monthPlanFit(7L, andre());

        assertEquals(new BigDecimal("1375.00"), result.newMonthlyCommitment(), "750 investment + 625 reserve");
        assertTrue(result.scenario().endBalance().compareTo(result.baseline().endBalance()) < 0);
        verify(plans, never()).save(any(MonthPlan.class));
    }

    @Test
    void anActivePlanEntersTheProjectionTheDailyLimitAndTheHomeTotals() {
        confirmIncomeAndRent();
        stored(andre(), true);

        PlanResponses.Projection projection = service.projection(7L, 3);
        MonthlyProjection.Month december = projection.items().get(1);
        assertTrue(projection.planActive());
        assertEquals(YearMonth.of(2026, 12), december.month());
        assertEquals(new BigDecimal("1375.00"), december.plan());
        assertEquals(new BigDecimal("5000.00"), december.inflowEstimated());
        assertEquals(new BigDecimal("1500.00"), december.outflowEstimated());

        var withPlan = future.overview(7L, 30).committed();
        assertTrue(withPlan.groups().stream().anyMatch(group -> group.category().equals("PLAN_INVESTMENT")));

        PlanResponses.CashFlow flow = service.cashFlow(7L, null);
        assertEquals("2026-11", flow.month());
        assertEquals(new BigDecimal("5000.00"), flow.home().income());
        assertEquals(new BigDecimal("1620.00"), flow.home().spending());
        assertEquals(BigDecimal.ZERO, flow.home().leisure(), "the market is not leisure");
        assertEquals(new BigDecimal("750.00"), flow.home().investment());
        assertEquals("Plano do mês", flow.home().investmentOrigin());
        assertEquals(new BigDecimal("750.00"), flow.home().leisureAndInvestment());
        assertEquals(new BigDecimal("1375.00"), service.view(7L).monthlyCommitment());
    }

    @Test
    void anInactivePlanLeavesTheProjectionAndAPastMonthHasNoInvestment() {
        confirmIncomeAndRent();
        stored(andre(), false);

        assertFalse(service.projection(7L, 6).planActive());
        assertEquals(BigDecimal.ZERO, service.projection(7L, 6).items().get(1).plan());
        PlanResponses.CashFlow october = service.cashFlow(7L, YearMonth.of(2026, 10));
        assertFalse(october.currentMonth());
        assertEquals(BigDecimal.ZERO, october.home().investment());
        assertEquals(new BigDecimal("1500.00"), october.spending().total());
    }

    @Test
    void theCashFlowCategoriesComeFromTheConfirmedAnswers() {
        confirmIncomeAndRent();

        PlanResponses.CashFlow flow = service.cashFlow(7L, YearMonth.of(2026, 11));

        assertEquals("SALARY", flow.income().byCategory().get(0).key());
        assertEquals(List.of("RENT", "ESSENTIAL"), flow.spending().byCategory().stream().map(group -> group.key()).toList());
        assertEquals(List.of("BOLETO", "PIX"), flow.spending().byMethod().stream().map(group -> group.key()).toList());
        assertEquals("Banco Aurora · Conta", flow.spending().byAccount().get(0).key());
    }

    @Test
    void monthsOutsideTheHistoryAndHorizonsOutsideTheListAreRejected() {
        assertEquals("INVALID_MONTH", code(() -> service.cashFlow(7L, YearMonth.of(2026, 12))));
        assertEquals("INVALID_MONTH", code(() -> service.cashFlow(7L, YearMonth.of(2025, 10))));
        assertEquals("INVALID_HORIZON", code(() -> service.projection(7L, 4)));
    }

    @Test
    void activatingStampsTheDateAndTurningOffClearsIt() {
        confirmIncomeAndRent();
        MonthPlan plan = stored(andre(), false);

        assertEquals("ACTIVE", service.setActive(7L, true).status());
        assertEquals(clock.instant(), plan.getActivatedAt());
        assertEquals("DRAFT", service.setActive(7L, false).status());
        assertNull(plan.getActivatedAt());
    }
}
