package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Two evidence-backed projections for the same charge: keep the observed higher price, or return
 * hypothetically to the historical median. Neither scenario changes a transaction or contacts a bank.
 */
public record BillingRadarPriceImpact(
        String counterparty,
        BigDecimal currentAmount,
        BigDecimal previousAmount,
        BigDecimal differencePerCharge,
        BigDecimal possibleSavings90Days,
        int projectedCharges,
        LocalDate firstExpectedDate,
        LocalDate lastExpectedDate,
        FutureResponses.ScenarioSummary keepCurrentPrice,
        FutureResponses.ScenarioSummary returnToPreviousPrice,
        FutureResponses.Projection keepCurrentPriceProjection,
        FutureResponses.Projection returnToPreviousPriceProjection
) {
}
