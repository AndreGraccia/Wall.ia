package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Goal;
import com.github.yildizmy.dto.request.FutureRequests;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FutureGoalsTest {

    private final GoalRepository goals = mock(GoalRepository.class);
    private final FutureService service = new FutureService(
            mock(WalletRepository.class), mock(TransactionRepository.class), mock(RecurrenceDecisionRepository.class),
            mock(CreditCardRepository.class), mock(LoanRepository.class), goals,
            mock(com.github.yildizmy.repository.EnvelopeRepository.class),
            mock(com.github.yildizmy.repository.ManualDebtRepository.class), mock(UserService.class),
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
                new FutureRequests.Goal("Viagem", new BigDecimal("300.00"), 10)));
        verify(goals, never()).save(any(Goal.class));
    }
}
