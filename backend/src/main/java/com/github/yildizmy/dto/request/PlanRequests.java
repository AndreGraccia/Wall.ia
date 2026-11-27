package com.github.yildizmy.dto.request;

import com.github.yildizmy.service.future.MonthPlanCalculator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Plano do mês and "Meu método" (ADR 0021). Shape and ranges are checked here (422); the rules that cross slices
 * (one FIXED, nothing measured as commitment, the sum) are checked by MonthPlanCalculator in the service.
 */
public final class PlanRequests {

    private PlanRequests() {
    }

    /**
     * @param percent    0 to 100, two decimals (7.5 = 7,5%)
     * @param commitment "virar compromisso": leaves the balance every month while the plan is active; null = false
     */
    public record Slice(
            @NotNull @Pattern(regexp = "^(FIXED|LEISURE|INVESTMENT|FUTURE|DEVELOPMENT|EMERGENCY|CUSTOM)$") String kind,
            @NotBlank @Size(max = MonthPlanCalculator.MAX_LABEL) String label,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") @Digits(integer = 3, fraction = 2) BigDecimal percent,
            Boolean commitment
    ) {
        MonthPlanCalculator.Slice toSlice() {
            return new MonthPlanCalculator.Slice(MonthPlanCalculator.Kind.valueOf(kind), label.trim(), percent,
                    Boolean.TRUE.equals(commitment));
        }
    }

    public record Plan(@NotNull @Size(min = 1, max = MonthPlanCalculator.MAX_SLICES) List<@Valid @NotNull Slice> slices) {

        public List<MonthPlanCalculator.Slice> toSlices() {
            return slices.stream().map(Slice::toSlice).toList();
        }
    }

    public record Activation(@NotNull Boolean active) {
    }

    /** Declared profile. NOT_SAID is a valid answer: nobody has to say anything. */
    public record Profile(
            @NotNull @Pattern(regexp = "^(SIMPLE|DETAILED|NOT_SAID)$") String preference,
            @NotNull @Pattern(regexp = "^(STABILITY|LEAVE_DEBT|ORGANIZE_MONTH|BUILD_RESERVE|OTHER|NOT_SAID)$") String mainGoal
    ) {
    }

    public record MethodChoice(
            @NotNull @Pattern(regexp = "^(PERCENT_503020|PERCENT_BALANCED|ZERO_BASED|PAY_YOURSELF_FIRST|PRIORITIES|"
                    + "INCOME_CYCLE|ENVELOPES|DEBT_AVALANCHE|DEBT_SNOWBALL)$") String method
    ) {
    }
}
