package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** "Minha evolução" (ADR 0026): what the person wrote. No score, no percentage, no judgement. */
public final class LifeGoalResponses {

    private LifeGoalResponses() {
    }

    public record LifeGoals(List<LifeGoal> items) {
    }

    public record LifeGoal(long id, String title, String currentSituation, String desiredSituation,
                           LocalDate targetDate, BigDecimal estimatedCost, LinkedGoal goal, List<Step> steps) {
    }

    public record LinkedGoal(long id, String name, BigDecimal monthlyAmount) {
    }

    public record Step(long id, String description, boolean done, LocalDate doneOn) {
    }
}
