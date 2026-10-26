package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A possible anomaly grounded in an Open Finance transaction owned by the caller.
 * An alert is a review prompt, never a fraud verdict or a bank-side action.
 */
public record ChargeAlertResponse(
        Long transactionId,
        String kind,
        String confidence,
        String description,
        String walletName,
        String institutionName,
        LocalDate date,
        BigDecimal amount,
        Long relatedTransactionId,
        LocalDate relatedDate,
        BigDecimal baselineAmount,
        BigDecimal difference,
        int occurrences,
        String decision
) {
}
