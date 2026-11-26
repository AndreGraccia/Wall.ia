package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Responses of the "Futuro" API. Every amount comes with the events that produced it,
 * so the client can always answer "why?".
 */
public final class FutureResponses {

    private FutureResponses() {
    }

    /**
     * @param labelKey  set when the label is text the system wrote (not a counterparty or a name the user typed), so
     *                  the UI translates it: DAILY_SPENDING, CARD_SPENDING, SCENARIO_PURCHASE, SCENARIO_SAVING,
     *                  TRANSFER_SENT, TRANSFER_RECEIVED, DEPOSIT, WITHDRAWAL (month plan events carry the person's own slice label)
     * @param originKey same for the origin: GOAL, MONTH_PLAN, USER_VALUE, AVERAGE_DAYS (with {@code originDays})
     */
    public record Event(
            LocalDate date,
            BigDecimal amount,
            String label,
            String kind,
            String category,
            String certainty,
            String origin,
            String reference,
            String labelKey,
            String originKey,
            Integer originDays
    ) {
    }

    public record DayPoint(LocalDate date, BigDecimal balance, BigDecimal inflow, BigDecimal outflow) {
    }

    public record RiskWindow(
            LocalDate start,
            LocalDate end,
            BigDecimal lowestBalance,
            LocalDate lowestDate,
            boolean untilHorizon,
            List<Event> causes,
            Event relief,
            BigDecimal overdraftCostCap,
            OverdraftEstimate overdraftEstimate
    ) {
    }

    /**
     * Estimated overdraft cost of a window: interest at the bank's rate (source BANK), the market median (MARKET)
     * or the legal cap (LEGAL_CAP), plus IOF. {@code monthlyRate} in percent; {@code referenceDate} is the start of
     * the Banco Central week the rate comes from.
     */
    public record OverdraftEstimate(
            BigDecimal interest,
            BigDecimal iof,
            BigDecimal total,
            BigDecimal monthlyRate,
            String source,
            String institution,
            LocalDate referenceDate
    ) {
    }

    public record Projection(
            int horizonDays,
            BigDecimal openingBalance,
            BigDecimal minBalance,
            LocalDate minDate,
            BigDecimal endBalance,
            long negativeDays,
            List<DayPoint> days,
            List<RiskWindow> riskWindows,
            List<Event> events
    ) {
    }

    public record CommittedGroup(String category, BigDecimal total, List<Event> items) {
    }

    /**
     * Money that already has a destination in the window: confirmed values and estimates are
     * reported separately and never merged.
     */
    public record Committed(
            LocalDate until,
            BigDecimal total,
            BigDecimal confirmed,
            BigDecimal estimated,
            List<CommittedGroup> groups
    ) {
    }

    /**
     * @param bankData freshness of the Open Finance accounts (null without them): institution, oldest sync and
     *                 whether it passed the limit, by the rule every screen shares (B50, ADR 0020)
     */
    public record Sources(int accounts, int cards, int loans, int confirmedRecurrences, int pendingQuestions,
                          com.github.yildizmy.service.future.BankDataFreshness.Status bankData) {
    }

    /**
     * Everyday spending (market, transport, pharmacy): a question like a recurrence.
     *
     * @param status        PENDING (not answered), CONFIRMED or REJECTED
     * @param suggestedDaily average per day found in the history, or null without enough history
     * @param appliedDaily  value the projection uses now (null unless CONFIRMED)
     * @param userDaily     value the user typed, when different from the suggestion
     * @param top           where most of the money went, as evidence for the question
     */
    public record DailySpending(
            String status,
            BigDecimal suggestedDaily,
            BigDecimal appliedDaily,
            BigDecimal userDaily,
            BigDecimal total,
            int days,
            int movements,
            List<SpendingItem> top
    ) {
    }

    public record SpendingItem(String counterparty, BigDecimal total, int count) {
    }

    /**
     * @param nextDate next day the goal takes money out of the projection
     */
    public record Goal(long id, String name, BigDecimal monthlyAmount, int dayOfMonth, LocalDate nextDate) {
    }

    public record Envelope(long id, String name, BigDecimal amount) {
    }

    /**
     * How right the forecast was, graded 7 to 30 days after it was made.
     *
     * @param since             first synced day kept (null before any sync)
     * @param firstComparisonOn when grading becomes possible (null before a forecast with confirmed answers)
     * @param meanAbsoluteError average miss in reais (null without comparisons)
     * @param bias              average signed miss (actual minus forecast): above zero the forecast was pessimistic
     * @param avoided           days forecast below zero that stayed at or above zero
     * @param missed            days below zero that the forecast did not see coming
     * @param recent            the latest comparisons, oldest first
     */
    public record Accuracy(LocalDate since, LocalDate firstComparisonOn, int comparisons, BigDecimal meanAbsoluteError,
                           BigDecimal bias, int avoided, int missed, List<AccuracyPoint> recent) {
    }

    /**
     * @param activeUsers              synced at least once in the period
     * @param gradedUsers              with at least one forecast graded in the period
     * @param avoidedPerActiveUserMonth the north star: avoided negative days per active user, per 30 days
     */
    public record NorthStar(int days, int activeUsers, int gradedUsers, int comparisons, int avoided, int missed,
                            BigDecimal meanAbsoluteError, BigDecimal avoidedPerActiveUserMonth) {
    }

    public record AccuracyPoint(LocalDate date, LocalDate forecastOn, BigDecimal projected, BigDecimal actual,
                                BigDecimal error) {
    }

    /**
     * @param reserved  sum of the envelopes
     * @param unbacked  part of the envelopes today's balance does not cover (zero when it does): an envelope
     *                  bigger than the money is a wish, and the screen must say so instead of hiding it
     */
    public record Envelopes(List<Envelope> items, BigDecimal balance, BigDecimal reserved, BigDecimal unbacked) {
    }

    /**
     * Answer to a free-text question. Only the fields of the detected intent are filled; every number
     * comes from the engine, and the client builds the sentence from them.
     *
     * @param intent  PURCHASE, DAILY_LIMIT, WHY_NEGATIVE, COMMITTED, NEXT_INCOME or UNKNOWN
     * @param verdict PURCHASE only: SAFE, TIGHT (no new negative day, but little room) or RISK (new negative days);
     *                NEED_AMOUNT when the question has no value
     */
    public record Answer(
            String intent,
            BigDecimal amount,
            int installments,
            String method,
            String verdict,
            BigDecimal balance,
            SpendingLimit spendingLimit,
            RiskWindow risk,
            Committed committed,
            Event nextIncome,
            ScenarioSummary before,
            ScenarioSummary after,
            BigDecimal newMonthlyCommitment,
            String cardName,
            List<ExitAction> exitPlan
    ) {
    }

    /**
     * How much can be spent per day until the next income without any day going below zero.
     *
     * @param bindingDate the day that sets the limit
     * @param pace        everyday spending the user confirmed, or null
     * @param margin      safeDaily minus pace: positive is room left, negative is how much to cut per day
     * @param shortfall   missing before {@code until} with bills alone, before any everyday spending (zero if none)
     * @param reserved    envelopes kept out of the limit: {@code safeDaily} is what can be spent without touching them,
     *                    and a {@code shortfall} may come only from them (the balance covers the bills, not the envelopes)
     */
    public record SpendingLimit(
            BigDecimal safeDaily,
            LocalDate until,
            boolean untilIncome,
            int days,
            LocalDate bindingDate,
            BigDecimal pace,
            BigDecimal margin,
            BigDecimal shortfall,
            BigDecimal reserved
    ) {
    }

    public record Overview(
            Instant generatedAt,
            LocalDate today,
            BigDecimal balance,
            BigDecimal freeAfterCommitments,
            Committed committed,
            Projection projection,
            Sources sources,
            DailySpending dailySpending,
            DailySpending cardSpending,
            SpendingLimit spendingLimit,
            List<ExitAction> exitPlan,
            BigDecimal reserved
    ) {
    }

    /**
     * One calculated way out of the first negative window. See {@code ExitPlan.Action}.
     *
     * @param type POSTPONE, CUT_DAILY or GAP
     */
    public record ExitAction(
            String type,
            String label,
            String category,
            BigDecimal amount,
            LocalDate from,
            LocalDate to,
            BigDecimal newDaily,
            BigDecimal resultingLowest,
            boolean solves
    ) {
    }

    public record Occurrence(long transactionId, LocalDate date, BigDecimal amount) {
    }

    /**
     * @param status PENDING (question not answered), CONFIRMED or REJECTED
     */
    /** @param counterpartyKey as {@link Event#labelKey()}, when the counterparty is system text (TRANSFER_SENT...) */
    public record Recurrence(
            String key,
            String counterparty,
            String counterpartyKey,
            String direction,
            String accountName,
            String institution,
            BigDecimal typicalAmount,
            boolean fixedAmount,
            int typicalDay,
            String confidence,
            String suggestedCategory,
            String status,
            String category,
            Instant decidedAt,
            List<Occurrence> occurrences
    ) {
    }

    public record InvoiceLine(String description, LocalDate purchaseDate, int installment, int installments, BigDecimal amount) {
    }

    /**
     * @param status CLOSED (waiting for payment), OPEN (still receiving purchases) or FUTURE (instalments already booked)
     */
    public record Invoice(String month, LocalDate closingDate, LocalDate dueDate, String status, BigDecimal total, List<InvoiceLine> lines) {
    }

    public record Card(
            long id,
            String name,
            String institution,
            String lastDigits,
            BigDecimal creditLimit,
            BigDecimal committedLimit,
            int closingDay,
            int dueDay,
            List<Invoice> invoices,
            LocalDate nextBillDueDate,
            BigDecimal nextBillTotal,
            BigDecimal nextBillMinimum
    ) {
    }

    public record Loan(
            long id,
            String product,
            String institution,
            BigDecimal contractedAmount,
            BigDecimal outstandingBalance,
            BigDecimal installmentAmount,
            int installmentsTotal,
            int installmentsPaid,
            int installmentsRemaining,
            /* As the bank reports it: stays in the past until the bank sees the payment. */
            LocalDate nextDueDate,
            /* First instalment due today or later (LoanPlan#upcomingDueDate); null when none is left. */
            LocalDate upcomingDueDate,
            LocalDate lastDueDate,
            BigDecimal annualRate,
            Instant lastSyncedAt,
            BigDecimal interestRemaining,
            BigDecimal nextInstallmentInterest,
            BigDecimal cet
    ) {
    }

    /**
     * @param manualDebts debts the person typed (Pix no crédito), never mixed with the bank's
     * @param bankData    freshness of the cards and loans shown (null without them), see {@link Sources}
     */
    public record Commitments(List<Card> cards, List<Loan> loans, List<ManualDebt> manualDebts,
                              com.github.yildizmy.service.future.BankDataFreshness.Status bankData) {
    }

    /**
     * A debt typed by the person (B14, ADR 0020).
     *
     * @param monthlyCet CET in percent a month, as typed
     * @param annualCet  the same rate over a year, which is what the payoff plan compares
     * @param origin     always MANUAL
     * @param certainty  always ESTIMATED: not checked against the institution
     */
    public record ManualDebt(long id, String kind, String label, BigDecimal outstandingBalance,
                             BigDecimal installmentAmount, BigDecimal monthlyCet, BigDecimal annualCet,
                             String origin, String certainty, Instant createdAt) {
    }

    public record ScenarioSummary(
            BigDecimal minBalance30,
            BigDecimal minBalance90,
            LocalDate minDate,
            LocalDate firstNegativeDate,
            long negativeDays,
            BigDecimal endBalance
    ) {
    }

    public record ScenarioResult(
            ScenarioSummary baseline,
            ScenarioSummary scenario,
            BigDecimal newMonthlyCommitment,
            int installments,
            String cardName,
            Projection baselineProjection,
            Projection scenarioProjection
    ) {
    }

    /**
     * @param plan             baseline, avalanche and snowball for the loans with balance, instalment and rate
     * @param loansWithoutRate loans left out because the bank did not send what the plan needs
     */
    public record DebtPayoff(com.github.yildizmy.service.future.DebtPayoff.Comparison plan, int loansWithoutRate) {
    }
}
