package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.LifeGoal;
import com.github.yildizmy.domain.entity.LifeGoalStep;
import com.github.yildizmy.dto.request.LifeGoalRequests;
import com.github.yildizmy.dto.response.LifeGoalResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LifeGoalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * "Minha evolução" (ADR 0026): where the person is, where she wants to get and the steps she marks. Nothing here is
 * scored or enters any calculation.
 */
@Service
@RequiredArgsConstructor
public class LifeGoalService {

    static final int MAX_LIFE_GOALS = 20;
    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final LifeGoalRepository lifeGoals;
    private final GoalRepository goals;
    private final UserService userService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public LifeGoalResponses.LifeGoals list(long userId) {
        return new LifeGoalResponses.LifeGoals(lifeGoals.findByUserIdOrderById(userId).stream()
                .map(LifeGoalService::toResponse).toList());
    }

    @Transactional
    public LifeGoalResponses.LifeGoals create(long userId, LifeGoalRequests.LifeGoal request) {
        userService.lockForUpdate(userId);
        if (lifeGoals.countByUserId(userId) >= MAX_LIFE_GOALS) throw new WalletRuleException("LIFE_GOAL_LIMIT");
        LifeGoal lifeGoal = new LifeGoal();
        lifeGoal.setUser(userService.getReferenceById(userId));
        lifeGoal.setCreatedAt(clock.instant());
        apply(userId, lifeGoal, request);
        lifeGoals.saveAndFlush(lifeGoal);
        return list(userId);
    }

    @Transactional
    public LifeGoalResponses.LifeGoals update(long userId, long id, LifeGoalRequests.LifeGoal request) {
        userService.lockForUpdate(userId);
        apply(userId, owned(userId, id), request);
        lifeGoals.flush(); // new steps get their id here
        return list(userId);
    }

    @Transactional
    public LifeGoalResponses.LifeGoals markStep(long userId, long id, long stepId, boolean done) {
        owned(userId, id).getSteps().stream()
                .filter(step -> step.getId() == stepId)
                .findFirst()
                .orElseThrow(() -> new WalletRuleException("LIFE_GOAL_STEP_NOT_FOUND"))
                .mark(done, clock.instant());
        return list(userId);
    }

    @Transactional
    public LifeGoalResponses.LifeGoals delete(long userId, long id) {
        lifeGoals.delete(owned(userId, id));
        return list(userId);
    }

    private LifeGoal owned(long userId, long id) {
        return lifeGoals.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new WalletRuleException("LIFE_GOAL_NOT_FOUND"));
    }

    private void apply(long userId, LifeGoal lifeGoal, LifeGoalRequests.LifeGoal request) {
        LocalDate target = request.targetDate();
        // A year the database cannot hold would be a 500.
        if (target != null && (target.getYear() < 1970 || target.getYear() > 2200)) {
            throw new WalletRuleException("INVALID_DATE");
        }
        lifeGoal.setTitle(request.title().trim());
        lifeGoal.setCurrentSituation(request.currentSituation().trim());
        lifeGoal.setDesiredSituation(request.desiredSituation().trim());
        lifeGoal.setTargetDate(target);
        lifeGoal.setEstimatedCost(request.estimatedCost() == null ? null
                : request.estimatedCost().setScale(2, RoundingMode.HALF_EVEN));
        // Looked up with the caller's id: another person's goal cannot be linked.
        lifeGoal.setGoal(request.goalId() == null ? null : goals.findByIdAndUserId(request.goalId(), userId)
                .orElseThrow(() -> new WalletRuleException("GOAL_NOT_FOUND")));

        Map<Long, LifeGoalStep> existing = new HashMap<>();
        lifeGoal.getSteps().forEach(step -> existing.put(step.getId(), step));
        List<LifeGoalStep> steps = new ArrayList<>();
        for (LifeGoalRequests.Step wanted : request.steps()) {
            LifeGoalStep step;
            if (wanted.id() == null) {
                step = new LifeGoalStep();
                step.setLifeGoal(lifeGoal);
            } else {
                // remove: the same id twice, or one from elsewhere, is not found.
                step = existing.remove(wanted.id());
                if (step == null) throw new WalletRuleException("LIFE_GOAL_STEP_NOT_FOUND");
            }
            step.setPosition(steps.size());
            step.setDescription(wanted.description().trim());
            step.mark(Boolean.TRUE.equals(wanted.done()), clock.instant());
            steps.add(step);
        }
        lifeGoal.getSteps().clear();
        lifeGoal.getSteps().addAll(steps);
    }

    private static LifeGoalResponses.LifeGoal toResponse(LifeGoal lifeGoal) {
        var goal = lifeGoal.getGoal();
        return new LifeGoalResponses.LifeGoal(lifeGoal.getId(), lifeGoal.getTitle(), lifeGoal.getCurrentSituation(),
                lifeGoal.getDesiredSituation(), lifeGoal.getTargetDate(), lifeGoal.getEstimatedCost(),
                goal == null ? null
                        : new LifeGoalResponses.LinkedGoal(goal.getId(), goal.getName(), goal.getMonthlyAmount()),
                lifeGoal.getSteps().stream()
                        .map(step -> new LifeGoalResponses.Step(step.getId(),
                                step.getDescription(), step.isDone(), step.getDoneAt() == null ? null
                                : LocalDate.ofInstant(step.getDoneAt(), ZONE)))
                        .toList());
    }
}
