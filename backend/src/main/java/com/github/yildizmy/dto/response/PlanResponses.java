package com.github.yildizmy.dto.response;

import com.github.yildizmy.service.future.BankDataFreshness;
import com.github.yildizmy.service.future.MethodAdvisor;
import com.github.yildizmy.service.future.MethodCatalog;
import com.github.yildizmy.service.future.MonthFlow;
import com.github.yildizmy.service.future.MonthlyProjection;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Plano do mês, Entradas e saídas, Projeção mensal and "Meu método" (proposta de André Graccia e documento de
 * evolução do grupo, ADR 0021).
 */
public final class PlanResponses {

    private PlanResponses() {
    }

    /**
     * @param status            ACTIVE; NEEDS_CONFIRMED_INCOME (no base, amounts null); EMPTY (nothing saved);
     *                          INCOMPLETE (saved, does not add up to 100%); DRAFT (complete, not active)
     * @param warnings          codes for the UI: INCOMPLETE, NEEDS_CONFIRMED_INCOME, ACTIVE_WITHOUT_INCOME
     * @param totalPercent      sum of the slices; 100 means complete
     * @param monthlyCommitment what the active plan takes from the balance per month; zero unless active with income
     * @param goalsInsideFuture monthly goals already set aside, counted inside a committed FUTURE slice
     */
    public record MonthPlan(String status, List<String> warnings, boolean saved, boolean complete,
                            BigDecimal totalPercent, boolean active, Instant activatedAt, Income income,
                            List<Slice> slices, BigDecimal monthlyCommitment, BigDecimal goalsInsideFuture,
                            FixedDetail fixed) {
    }

    /**
     * Base of the plan: confirmed incomes only. Each value is the recurrence's typical amount, so it is ESTIMATED.
     *
     * @param nextDate next day the main income, and so the plan, is expected
     */
    public record Income(BigDecimal monthly, int day, LocalDate nextDate, String certainty, String origin,
                         List<IncomeSource> sources) {
    }

    public record IncomeSource(String key, String counterparty, String category, BigDecimal amount, int typicalDay) {
    }

    /**
     * @param role      THERMOMETER (FIXED: measured, no effect), CEILING (LEISURE: spent against the slice), COMMITMENT
     *                  (marked: leaves the balance on income day while the plan is active) or RESERVED (unmarked: only
     *                  a reference on screen)
     * @param amount    base x percent in cents; null without confirmed income
     * @param used      FIXED: confirmed fixed outflows per month; LEISURE: everyday spending so far this month
     * @param committed COMMITMENT only: what leaves the balance per month (a FUTURE slice minus the goals)
     */
    public record Slice(int position, String kind, String label, BigDecimal percent, boolean commitment, String role,
                        BigDecimal amount, BigDecimal used, BigDecimal usedPercent, BigDecimal remaining,
                        BigDecimal committed, String certainty, String origin) {
    }

    /** @param recurring confirmed rent, bills and subscriptions (ESTIMATED); @param loans bank instalments (CONFIRMED) */
    public record FixedDetail(BigDecimal recurring, BigDecimal loans) {
    }

    /** One month of settled movements, cash regime (ADR 0011), without transfers between the person's own accounts. */
    public record CashFlow(String month, boolean currentMonth, MonthFlow.Side income, MonthFlow.Side spending,
                           Home home, BankDataFreshness.Status bankData) {
    }

    /**
     * The three totals of the Início screen.
     *
     * @param leisure              everyday spending of the month (what the leisure slice measures), from the statement
     * @param investment           the committed INVESTMENT slice of the active plan, current month only. There is no
     *                             record of a real contribution, so this is the decision, not the movement; zero otherwise
     * @param investmentOrigin     "Plano do mês" when {@code investment} comes from the plan, null otherwise
     */
    public record Home(BigDecimal income, BigDecimal spending, BigDecimal leisure, BigDecimal investment,
                       String investmentOrigin, BigDecimal leisureAndInvestment) {
    }

    /** @param planActive whether the plan commitments are in {@code items} (column {@code plan}) */
    public record Projection(int months, LocalDate from, LocalDate until, BigDecimal openingBalance, boolean planActive,
                             List<MonthlyProjection.Month> items) {
    }

    public record Catalog(String version, List<MethodCatalog.Method> methods) {
    }

    /**
     * Computed from the data on every call, never stored.
     *
     * @param confirmedIncome   monthly confirmed income, null when none
     * @param fixedSharePercent confirmed fixed outflows over the confirmed income, one decimal; null without income
     */
    public record Derived(BigDecimal confirmedIncome, boolean variableIncome, BigDecimal fixedMonthly,
                          BigDecimal fixedSharePercent, int debtsWithRate) {
    }

    /** @param data the numbers the rules read, so the person can check why */
    public record Suggestions(String catalogVersion, boolean needsConfirmedIncome, String preference,
                              List<MethodAdvisor.Suggestion> suggestions, Derived data) {
    }

    public record MethodChoice(String method, String catalogVersion, Instant chosenAt) {
    }

    /**
     * @param method        the current method (the latest choice), null when none
     * @param methodHistory newest first, up to 20
     */
    public record Profile(String preference, String mainGoal, Instant updatedAt, String method,
                          List<MethodChoice> methodHistory, Derived derived) {
    }
}
