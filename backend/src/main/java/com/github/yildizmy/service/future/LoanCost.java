package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * What a loan still costs, in reais: the transparency investment platforms show about their own fees,
 * turned toward the person who owes. Two numbers, both from data the bank already sends.
 * <p>
 * Interest still to pay depends on the amortisation system the bank reports:
 * <ul>
 *   <li>Price (fixed instalment): instalment x instalments left - outstanding balance, with no rate guess.</li>
 *   <li>SAC (fixed amortisation, falling instalment): monthly rate x balance x (n + 1) / 2, because the balance
 *       falls by balance / n each month and interest is charged on what is left.</li>
 *   <li>Anything else: unknown, so no number.</li>
 * </ul>
 * Interest inside the next instalment = outstanding balance x monthly rate equivalent to the annual one.
 */
public final class LoanCost {

    private LoanCost() {
    }

    /**
     * @param system            Open Finance amortizationScheduled (PRICE, SAC, ...); null is read as PRICE, the only
     *                          system the sandbox had before the field existed
     * @param annualRatePercent needed for SAC only
     */
    public static BigDecimal interestRemaining(String system, BigDecimal installment, int remaining,
                                               BigDecimal outstanding, BigDecimal annualRatePercent) {
        if (system == null || "PRICE".equals(system)) return interestRemaining(installment, remaining, outstanding);
        if (!"SAC".equals(system) || outstanding == null || remaining <= 0
                || annualRatePercent == null || annualRatePercent.signum() <= 0) return null;
        BigDecimal interest = outstanding.multiply(monthlyRate(annualRatePercent))
                .multiply(BigDecimal.valueOf(remaining + 1L))
                .divide(BigDecimal.valueOf(2), MathContext.DECIMAL64);
        return interest.setScale(2, RoundingMode.HALF_UP);
    }

    /** Price only. Null when the bank did not send enough to say it honestly. */
    static BigDecimal interestRemaining(BigDecimal installment, int remaining, BigDecimal outstanding) {
        if (installment == null || outstanding == null || remaining <= 0) return null;
        BigDecimal interest = installment.multiply(BigDecimal.valueOf(remaining)).subtract(outstanding);
        return interest.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    /** @param annualRatePercent e.g. 29.84 for 29,84% a.a. */
    public static BigDecimal nextInstallmentInterest(BigDecimal outstanding, BigDecimal annualRatePercent, BigDecimal installment) {
        if (outstanding == null || annualRatePercent == null || annualRatePercent.signum() <= 0) return null;
        BigDecimal interest = outstanding.multiply(monthlyRate(annualRatePercent));
        // Never more than the instalment itself: a mismatch in the bank data must not produce a nonsense split.
        if (installment != null) interest = interest.min(installment);
        return interest.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Monthly percent to the equivalent annual percent: 8 (% a.m.) becomes 151.817... (% a.a.). Used for the CET
     * a person types for "Pix no crédito", which banks show per month (B14).
     */
    public static BigDecimal annualFromMonthly(BigDecimal monthlyRatePercent) {
        BigDecimal factor = BigDecimal.ONE.add(monthlyRatePercent.movePointLeft(2)).pow(12, MathContext.DECIMAL64);
        return factor.subtract(BigDecimal.ONE).movePointRight(2).setScale(6, java.math.RoundingMode.HALF_UP);
    }

    static BigDecimal monthlyRate(BigDecimal annualRatePercent) {
        return new BigDecimal(Math.pow(1 + annualRatePercent.doubleValue() / 100, 1.0 / 12) - 1, MathContext.DECIMAL64);
    }
}
