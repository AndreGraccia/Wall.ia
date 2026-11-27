package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Goal;
import com.github.yildizmy.domain.entity.LifeGoal;
import com.github.yildizmy.domain.entity.LifeGoalStep;
import com.github.yildizmy.dto.request.LifeGoalRequests;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LifeGoalRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LifeGoalServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-27T12:00:00Z");
    private static final Instant BEFORE = Instant.parse("2026-11-01T12:00:00Z");

    private final LifeGoalRepository lifeGoals = mock(LifeGoalRepository.class);
    private final GoalRepository goals = mock(GoalRepository.class);
    private final UserService users = mock(UserService.class);
    private final LifeGoalService service = new LifeGoalService(lifeGoals, goals, users,
            Clock.fixed(NOW, ZoneOffset.UTC));

    private static LifeGoalRequests.LifeGoal request(Long goalId, LifeGoalRequests.Step... steps) {
        return new LifeGoalRequests.LifeGoal(" Mudar de área ", " Atendo no balcão ", " Programar ",
                LocalDate.of(2027, 12, 1), new BigDecimal("1200"), goalId, List.of(steps));
    }

    @Test
    void creatingKeepsTheWordsTheStepsInOrderAndTheCallersGoal() {
        Goal goal = new Goal();
        goal.setId(3L);
        when(goals.findByIdAndUserId(3L, 7L)).thenReturn(Optional.of(goal));

        service.create(7L, request(3L, new LifeGoalRequests.Step(null, " Curso ", true),
                new LifeGoalRequests.Step(null, "Projeto", false)));

        ArgumentCaptor<LifeGoal> saved = ArgumentCaptor.forClass(LifeGoal.class);
        verify(lifeGoals).saveAndFlush(saved.capture());
        assertEquals("Mudar de área", saved.getValue().getTitle());
        assertEquals("Atendo no balcão", saved.getValue().getCurrentSituation());
        assertEquals("1200.00", saved.getValue().getEstimatedCost().toPlainString());
        assertEquals(goal, saved.getValue().getGoal());
        assertEquals(List.of("Curso", "Projeto"),
                saved.getValue().getSteps().stream().map(LifeGoalStep::getDescription).toList());
        assertEquals(List.of(0, 1), saved.getValue().getSteps().stream().map(LifeGoalStep::getPosition).toList());
        assertEquals(NOW, saved.getValue().getSteps().get(0).getDoneAt());
        assertNull(saved.getValue().getSteps().get(1).getDoneAt());
    }

    @Test
    void someoneElsesGoalCannotBeLinked() {
        when(goals.findByIdAndUserId(3L, 7L)).thenReturn(Optional.empty());
        assertEquals("GOAL_NOT_FOUND", code(() -> service.create(7L, request(3L))));
        verify(lifeGoals, never()).saveAndFlush(any());
    }

    @Test
    void theLimitAndAnImpossibleDateAreRefused() {
        var absurd = new LifeGoalRequests.LifeGoal("t", "a", "b", LocalDate.of(999999, 1, 1), null, null, List.of());
        assertEquals("INVALID_DATE", code(() -> service.create(7L, absurd)));
        when(lifeGoals.countByUserId(7L)).thenReturn((long) LifeGoalService.MAX_LIFE_GOALS);
        assertEquals("LIFE_GOAL_LIMIT", code(() -> service.create(7L, request(null))));
    }

    @Test
    void editingKeepsADoneStepsDateReordersAndDropsTheOnesLeftOut() {
        LifeGoal existing = lifeGoal(step(1, "Curso", BEFORE), step(2, "Antigo", null));
        when(lifeGoals.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(existing));

        service.update(7L, 5L, request(null, new LifeGoalRequests.Step(null, "Novo", false),
                new LifeGoalRequests.Step(1L, "Curso concluído", true)));

        assertEquals(List.of("Novo", "Curso concluído"),
                existing.getSteps().stream().map(LifeGoalStep::getDescription).toList());
        assertEquals(BEFORE, existing.getSteps().get(1).getDoneAt());
        assertEquals(1, existing.getSteps().get(1).getPosition());
    }

    @Test
    void aStepFromElsewhereOrRepeatedIsNotFound() {
        when(lifeGoals.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(lifeGoal(step(1, "Curso", null))));
        var one = new LifeGoalRequests.Step(1L, "Curso", false);
        assertEquals("LIFE_GOAL_STEP_NOT_FOUND",
                code(() -> service.update(7L, 5L, request(null, new LifeGoalRequests.Step(99L, "x", false)))));
        assertEquals("LIFE_GOAL_STEP_NOT_FOUND", code(() -> service.update(7L, 5L, request(null, one, one))));
        assertEquals("LIFE_GOAL_STEP_NOT_FOUND", code(() -> service.markStep(7L, 5L, 99L, true)));
    }

    @Test
    void aStepIsMarkedAndUnmarked() {
        LifeGoal existing = lifeGoal(step(1, "Curso", null));
        when(lifeGoals.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(existing));
        service.markStep(7L, 5L, 1L, true);
        assertEquals(NOW, existing.getSteps().get(0).getDoneAt());
        service.markStep(7L, 5L, 1L, false);
        assertNull(existing.getSteps().get(0).getDoneAt());
    }

    @Test
    void someoneElsesLifeGoalIsNotFoundOnEveryChange() {
        when(lifeGoals.findByIdAndUserId(5L, 8L)).thenReturn(Optional.empty());
        assertEquals("LIFE_GOAL_NOT_FOUND", code(() -> service.update(8L, 5L, request(null))));
        assertEquals("LIFE_GOAL_NOT_FOUND", code(() -> service.markStep(8L, 5L, 1L, true)));
        assertEquals("LIFE_GOAL_NOT_FOUND", code(() -> service.delete(8L, 5L)));
        verify(lifeGoals, never()).delete(any());
    }

    private static String code(Runnable call) {
        return assertThrows(WalletRuleException.class, call::run).getMessage();
    }

    private static LifeGoal lifeGoal(LifeGoalStep... steps) {
        LifeGoal lifeGoal = new LifeGoal();
        lifeGoal.setId(5L);
        lifeGoal.getSteps().addAll(List.of(steps));
        return lifeGoal;
    }

    private static LifeGoalStep step(long id, String description, Instant doneAt) {
        LifeGoalStep step = new LifeGoalStep();
        step.setId(id);
        step.setDescription(description);
        step.setDone(doneAt != null);
        step.setDoneAt(doneAt);
        return step;
    }
}
