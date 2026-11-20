package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record InsightReportResponse(
        String provider,
        int periodMonths,
        Instant generatedAt,
        String headline,
        String summary,
        FinancialMetrics metrics,
        List<MonthlyFlow> monthlyFlow,
        List<InsightItem> observations,
        List<InsightItem> recommendedActions,
        List<InsightReference> references,
        String disclaimer,
        String privacyNotice,
        /* Freshness of the Open Finance accounts behind the totals; null without them (B50, ADR 0020). */
        com.github.yildizmy.service.future.BankDataFreshness.Status bankData
) {
    public record FinancialMetrics(
            BigDecimal inflow,
            BigDecimal outflow,
            BigDecimal internalTransfers,
            BigDecimal netFlow,
            long transactionCount
    ) {
    }

    public record MonthlyFlow(String month, BigDecimal inflow, BigDecimal outflow) {
    }

    public record InsightItem(String title, String body, String tone, List<String> citationIds) {
    }

    public record InsightReference(
            String id,
            String title,
            String author,
            Integer year,
            String url,
            String relevance
    ) {
    }
}
