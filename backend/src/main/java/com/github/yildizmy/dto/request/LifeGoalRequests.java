package com.github.yildizmy.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** "Minha evolução" (ADR 0026). */
public final class LifeGoalRequests {

    private LifeGoalRequests() {
    }

    /**
     * The whole life goal: a missing optional field is cleared, a step left out is removed.
     *
     * @param goalId a monthly goal of the caller, or null for no link
     */
    public record LifeGoal(
            @NotBlank @Size(max = 80) String title,
            @NotBlank @Size(max = 1000) String currentSituation,
            @NotBlank @Size(max = 1000) String desiredSituation,
            LocalDate targetDate,
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal estimatedCost,
            Long goalId,
            @NotNull @Size(max = 20) List<@Valid @NotNull Step> steps
    ) {
    }

    /**
     * @param id   of an existing step of this life goal; null for a new one
     * @param done null = false
     */
    public record Step(Long id, @NotBlank @Size(max = 140) String description, Boolean done) {
    }

    public record StepDone(@NotNull Boolean done) {
    }
}
