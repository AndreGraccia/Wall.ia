package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Evidence-backed signals from the user's own transaction history.
 * A signal is a prompt to review a charge, never proof of fraud or a financial instruction.
 */
public record BillingRadarReport(
        Instant generatedAt,
        LocalDate dataThrough,
        Instant bankDataAsOf,
        boolean bankDataStale,
        int accounts,
        int recurringCount,
        int priceIncreaseCount,
        int possibleDuplicateCount,
        BigDecimal projectedMonthlyTotal,
        List<Item> items
) {
    public record Item(
            String key,
            String counterparty,
            boolean recurring,
            boolean priceIncrease,
            boolean possibleDuplicate,
            String confidence,
            BigDecimal latestAmount,
            BigDecimal baselineAmount,
            BigDecimal increaseAmount,
            BigDecimal increasePercent,
            LocalDate lastChargeDate,
            LocalDate nextExpectedDate,
            int occurrences,
            LocalDate duplicateDate,
            BigDecimal duplicateAmount,
            int duplicateCount,
            List<Occurrence> evidence
    ) {
    }

    public record Occurrence(
            long transactionId,
            LocalDate date,
            BigDecimal amount,
            String accountName,
            String institution
    ) {
    }
}
