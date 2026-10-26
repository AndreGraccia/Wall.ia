package com.github.yildizmy.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public final class FutureRequests {

    private FutureRequests() {
    }

    /**
     * @param status PENDING removes the answer and turns the pattern back into a question
     */
    public record RecurrenceDecision(
            @NotBlank @Size(max = 120) String key,
            @NotNull @Pattern(regexp = "^(CONFIRMED|REJECTED|PENDING)$") String status,
            @Pattern(regexp = "^(SALARY|OTHER_INCOME|RENT|SUBSCRIPTION|BILL|OTHER)$") String category
    ) {
    }

    public record Question(@NotBlank @Size(max = 300) String question) {
    }

    public record Goal(
            @NotBlank @Size(max = 60) String name,
            @NotNull @DecimalMin("0.01") @DecimalMax("1000000.00") @Digits(integer = 7, fraction = 2) BigDecimal monthlyAmount,
            @NotNull @Min(1) @Max(31) Integer dayOfMonth
    ) {
    }

    /** The browser's PushSubscription.toJSON(). */
    /** @param refresh true when the page re-sends the browser's current subscription on load */
    public record PushSubscription(@NotBlank @Size(max = 1000) String endpoint, @NotNull @Valid PushKeys keys,
                                   Boolean refresh) {
    }

    public record PushKeys(@NotBlank @Size(max = 100) String p256dh, @NotBlank @Size(max = 50) String auth) {
    }

    public record PushEndpoint(@NotBlank @Size(max = 1000) String endpoint) {
    }

    public record PixInterest(@NotNull @Pattern(regexp = "^(PREPARE|CONFIRM)$") String step) {
    }

    public record Envelope(
            @NotBlank @Size(max = 60) String name,
            @NotNull @DecimalMin("0.01") @DecimalMax("1000000.00") @Digits(integer = 7, fraction = 2) BigDecimal amount
    ) {
    }

    /**
     * @param source      ACCOUNT (default) for account spending, CARD for everyday card purchases
     * @param dailyAmount the user's own value per day; null keeps the estimate from the history
     */
    public record DailySpendingDecision(
            @NotNull @Pattern(regexp = "^(CONFIRMED|REJECTED|PENDING)$") String status,
            @Pattern(regexp = "^(ACCOUNT|CARD)$") String source,
            @DecimalMin("0.00") @DecimalMax("100000.00") @Digits(integer = 6, fraction = 2) BigDecimal dailyAmount
    ) {
    }

    public record ChargeAlertDecision(
            @NotNull @Pattern(regexp = "^(REVIEW|NOT_ANOMALOUS|RESOLVED)$") String decision
    ) {
    }

    /**
     * One hypothetical decision for Modo Futuro. Fields that do not apply to the type are ignored.
     */
    public record Scenario(
            @NotNull @Pattern(regexp = "^(PURCHASE|SAVINGS|INCOME_LOSS|REFUND)$") String type,
            @DecimalMin("0.01") @DecimalMax("9999999999.99") @Digits(integer = 10, fraction = 2) BigDecimal amount,
            @Min(1) @Max(24) Integer installments,
            @Pattern(regexp = "^(CASH|CARD)$") String method,
            Long cardId,
            @Min(1) @Max(31) Integer dayOfMonth,
            @Min(1) @Max(12) Integer months,
            @Size(max = 120) String incomeKey,
            @Size(max = 60) String label
    ) {
    }
}
