package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * "In what order do I pay my debts off, and what does it save?" (ADR 0013). No credit is offered: the plan only
 * reorders money the person already pays, plus the extra they choose.
 * <p>
 * Every month each debt accrues interest at its own rate and gets its instalment. The monthly budget stays the
 * sum of today's instalments plus the extra; whatever is left (the extra, and the instalment of every debt already
 * gone) goes to the target debt: highest rate first (avalanche) or smallest balance first (snowball). The baseline
 * pays only the instalments and never rolls anything over. Early payment with proportional interest reduction is a
 * right in Brazil (CDC art. 52, par. 2), which is what paying the balance down models.
 */
public final class DebtPayoff {

    /** 50 years: past that the instalment does not cover the interest and the debt never ends. */
    static final int MAX_MONTHS = 600;

    public enum Strategy {AVALANCHE, SNOWBALL}

    /**
     * @param annualRatePercent e.g. 29.84 for 29,84% a.a.
     * @param origin            OPEN_FINANCE (sent by the bank) or MANUAL (typed by the person, B14), so the screen
     *                          can say where each line of the order came from
     */
    public record Debt(String id, String label, BigDecimal balance, BigDecimal installment, BigDecimal annualRatePercent,
                       String origin) {
        public Debt(String id, String label, BigDecimal balance, BigDecimal installment, BigDecimal annualRatePercent) {
            this(id, label, balance, installment, annualRatePercent, "OPEN_FINANCE");
        }
    }

    /** @param month 1 for the first month from now; null when it never ends within {@link #MAX_MONTHS} */
    public record Payoff(String id, String label, Integer month, String origin) {
    }

    /**
     * @param months null when some debt never ends; interest paid until the end, or until {@link #MAX_MONTHS}
     * @param order  the order the extra goes to (the strategy), each with the month it ends
     */
    public record Plan(Integer months, BigDecimal interest, List<Payoff> order) {
    }

    /** @param interestSaved baseline interest minus the strategy's, per strategy */
    public record Comparison(BigDecimal extraMonthly, Plan baseline, Plan avalanche, Plan snowball,
                             BigDecimal avalancheSaves, BigDecimal snowballSaves) {
    }

    private DebtPayoff() {
    }

    public static Comparison compare(List<Debt> debts, BigDecimal extraMonthly) {
        BigDecimal extra = extraMonthly == null ? BigDecimal.ZERO : extraMonthly.max(BigDecimal.ZERO);
        Plan baseline = simulate(debts, BigDecimal.ZERO, byRate(), false);
        Plan avalanche = simulate(debts, extra, byRate(), true);
        Plan snowball = simulate(debts, extra, byBalance(), true);
        return new Comparison(extra, baseline, avalanche, snowball,
                baseline.interest().subtract(avalanche.interest()),
                baseline.interest().subtract(snowball.interest()));
    }

    static Comparator<Debt> byRate() {
        return Comparator.comparing(Debt::annualRatePercent).reversed().thenComparing(Debt::balance);
    }

    static Comparator<Debt> byBalance() {
        return Comparator.comparing(Debt::balance).thenComparing(Comparator.comparing(Debt::annualRatePercent).reversed());
    }

    static Plan simulate(List<Debt> debts, BigDecimal extra, Comparator<Debt> priority, boolean rollOver) {
        List<Debt> order = debts.stream().sorted(priority).toList();
        int n = order.size();
        BigDecimal[] balance = new BigDecimal[n];
        Integer[] endedIn = new Integer[n];
        for (int i = 0; i < n; i++) balance[i] = order.get(i).balance();
        BigDecimal budget = order.stream().map(Debt::installment).reduce(extra, BigDecimal::add);
        BigDecimal interest = BigDecimal.ZERO;

        int ended = 0;
        int month = 0;
        while (ended < n && month < MAX_MONTHS) {
            month++;
            BigDecimal left = budget;
            for (int i = 0; i < n; i++) {
                if (balance[i].signum() <= 0) continue;
                Debt debt = order.get(i);
                BigDecimal charged = balance[i].multiply(LoanCost.monthlyRate(debt.annualRatePercent()))
                        .setScale(2, RoundingMode.HALF_UP);
                interest = interest.add(charged);
                BigDecimal owed = balance[i].add(charged);
                BigDecimal paid = owed.min(debt.installment());
                balance[i] = owed.subtract(paid);
                left = left.subtract(paid);
            }
            // Extra and freed instalments, in priority order, cascading when the target is gone.
            for (int i = 0; rollOver && i < n && left.signum() > 0; i++) {
                if (balance[i].signum() <= 0) continue;
                BigDecimal paid = balance[i].min(left);
                balance[i] = balance[i].subtract(paid);
                left = left.subtract(paid);
            }
            for (int i = 0; i < n; i++) {
                if (endedIn[i] == null && balance[i].signum() <= 0) {
                    endedIn[i] = month;
                    ended++;
                }
            }
        }

        List<Payoff> payoffs = new ArrayList<>();
        for (int i = 0; i < n; i++) payoffs.add(new Payoff(order.get(i).id(), order.get(i).label(), endedIn[i], order.get(i).origin()));
        return new Plan(ended == n ? month : null, interest.setScale(2, RoundingMode.HALF_UP), payoffs);
    }
}
