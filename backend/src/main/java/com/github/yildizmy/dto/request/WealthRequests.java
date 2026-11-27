package com.github.yildizmy.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Investments typed by the person (ADR 0026). Dates in the future are refused by the service. */
public final class WealthRequests {

    public static final String CLASSES = "^(SAVINGS|FIXED_INCOME|FUND|STOCK|PENSION|CRYPTO|REAL_ESTATE|OTHER)$";

    private WealthRequests() {
    }

    public record NewInvestment(
            @NotBlank @Size(max = 60) String institution,
            @NotBlank @Size(max = 60) String name,
            @NotNull @Pattern(regexp = CLASSES) String assetClass,
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal value,
            @NotNull LocalDate valueDate,
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal investedAmount,
            LocalDate maturityDate,
            @Size(max = 500) String note
    ) {
        public Details details() {
            return new Details(institution, name, assetClass, investedAmount, maturityDate, note);
        }
    }

    /** Everything but the value, which has its own dated history. A missing optional field is cleared. */
    public record Details(
            @NotBlank @Size(max = 60) String institution,
            @NotBlank @Size(max = 60) String name,
            @NotNull @Pattern(regexp = CLASSES) String assetClass,
            @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal investedAmount,
            LocalDate maturityDate,
            @Size(max = 500) String note
    ) {
    }

    public record Value(
            @NotNull @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal value,
            @NotNull LocalDate valueDate
    ) {
    }
}
