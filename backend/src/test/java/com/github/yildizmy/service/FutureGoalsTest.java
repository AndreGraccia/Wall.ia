package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Goal;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.dto.request.FutureRequests;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.future.CashEvent;
import com.github.yildizmy.service.future.CashEventPlanner;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FutureGoalsTest {

    private final GoalRepository goals = mock(GoalRepository.class);
    private final WalletRepository wallets = mock(WalletRepository.class);
    private final FutureService service = new FutureService(
            wallets, mock(TransactionRepository.class), mock(RecurrenceDecisionRepository.class),
            mock(CreditCardRepository.class), mock(LoanRepository.class), goals,
            mock(com.github.yildizmy.repository.EnvelopeRepository.class),
            mock(com.github.yildizmy.repository.ManualDebtRepository.class), mock(com.github.yildizmy.repository.MonthPlanRepository.class), mock(UserService.class),
            mock(com.github.yildizmy.service.market.MarketRatesService.class),
            Clock.fixed(Instant.parse("2026-01-30T15:00:00Z"), ZoneOffset.UTC));

    @Test
    void aGoalOnThe31stFallsOnTheLastDayOfShortMonthsAndTodayIsNeverCounted() {
        LocalDate today = LocalDate.of(2026, 1, 31);
        List<CashEvent> events = CashEventPlanner.goals(
                List.of(new CashEventPlanner.GoalPlan(1, "Reserva", new BigDecimal("200.00"), 31)), today, LocalDate.of(2026, 4, 30));

        assertEquals(List.of(LocalDate.of(2026, 2, 28), LocalDate.of(2026, 3, 31), LocalDate.of(2026, 4, 30)),
                events.stream().map(CashEvent::date).toList());
        assertEquals(CashEvent.Certainty.CONFIRMED, events.get(0).certainty());
        assertEquals(new BigDecimal("-200.00"), events.get(0).amount());
    }

    @Test
    void anotherUsersGoalIsNotFoundAndNothingIsDeleted() {
        when(goals.findByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());

        assertThrows(WalletRuleException.class, () -> service.deleteGoal(7L, 99L));
        verify(goals, never()).delete(any());
    }

    @Test
    void tenGoalsIsTheLimit() {
        when(goals.countByUserId(7L)).thenReturn(10L);

        assertThrows(WalletRuleException.class, () -> service.createGoal(7L,
                request("300.00", null, null, null)));
        verify(goals, never()).save(any(Goal.class));
    }

    @Test
    void anotherUsersGoalCannotBeUpdated() {
        when(goals.findByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());

        WalletRuleException error = assertThrows(WalletRuleException.class,
                () -> service.updateGoal(7L, 99L, request("300.00", null, null, null)));
        assertEquals("GOAL_NOT_FOUND", error.getMessage());
    }

    @Test
    void aDateNeedsATargetAndMustBeWithinFiftyYears() {
        assertEquals("GOAL_DATE_NEEDS_TARGET", refused(request("300.00", null, "2026-06-10", null)));
        assertEquals("GOAL_DATE_TOO_FAR", refused(request("300.00", "1000.00", "1975-01-31", null)));
        assertEquals("GOAL_DATE_TOO_FAR", refused(request("300.00", "1000.00", "2076-01-31", null)));
        verify(goals, never()).save(any(Goal.class));
    }

    @Test
    void aGoalWhoseDatePassedCanStillBeUpdatedAndSaysSo() {
        Goal goal = stored("300.00", "1000.00", "2026-01-10", null);
        when(goals.findByIdAndUserId(1L, 7L)).thenReturn(Optional.of(goal));

        FutureResponses.Goal response = service.updateGoal(7L, 1L, request("300.00", "1000.00", "2026-01-10", "400.00"));

        assertEquals("DATE_TOO_SOON", response.progress().status());
        assertEquals(new BigDecimal("600.00"), response.progress().remaining());
        assertEquals("USER_VALUE", response.savedOrigin());
    }

    @Test
    void aGoalWithoutATargetAnswersAsBefore() {
        when(goals.findByUserIdOrderById(7L)).thenReturn(List.of(stored("300.00", null, null, null)));

        FutureResponses.Goal response = service.goals(7L).get(0);

        assertNull(response.progress());
        assertNull(response.savedOrigin());
        assertEquals(LocalDate.of(2026, 2, 10), response.nextDate());
        verify(wallets, never()).findByUserId(7L); // no history read for a plain goal
    }

    @Test
    void theRequiredContributionIsCheckedAgainstTheProjectionWithoutSaving() {
        when(goals.findByUserIdOrderById(7L)).thenReturn(List.of(stored("100.00", "3000.00", "2026-03-31", null)));
        Wallet wallet = new Wallet();
        wallet.setId(1L);
        wallet.setBalance(new BigDecimal("1500.00"));
        when(wallets.findByUserId(7L)).thenReturn(List.of(wallet));

        FutureResponses.GoalProgress progress = service.goals(7L).get(0).progress();

        // Two contribution days left (10/02 and 10/03): R$ 1.500 each, and the balance only covers one.
        assertEquals("LATE", progress.status());
        assertEquals(new BigDecimal("1500.00"), progress.requiredMonthly());
        assertFalse(progress.fit().fits());
        assertEquals(0, progress.fit().baseline().negativeDays());
        assertTrue(progress.fit().scenario().negativeDays() > 0);
        assertFalse(progress.fit().incomeConfirmed());
        verify(goals, never()).save(any(Goal.class));

        wallet.setBalance(new BigDecimal("100000.00"));
        assertTrue(service.goals(7L).get(0).progress().fit().fits());
    }

    private String refused(FutureRequests.Goal request) {
        return assertThrows(WalletRuleException.class, () -> service.createGoal(7L, request)).getMessage();
    }

    private static FutureRequests.Goal request(String monthly, String target, String date, String saved) {
        return new FutureRequests.Goal("Viagem", new BigDecimal(monthly), 10, decimal(target),
                date == null ? null : LocalDate.parse(date), decimal(saved));
    }

    private static Goal stored(String monthly, String target, String date, String saved) {
        Goal goal = new Goal();
        goal.setId(1L);
        goal.setName("Viagem");
        goal.setMonthlyAmount(new BigDecimal(monthly));
        goal.setDayOfMonth(10);
        goal.setTargetAmount(decimal(target));
        goal.setTargetDate(date == null ? null : LocalDate.parse(date));
        goal.setSavedAmount(decimal(saved));
        return goal;
    }

    private static BigDecimal decimal(String value) {
        return value == null ? null : new BigDecimal(value);
    }
}
