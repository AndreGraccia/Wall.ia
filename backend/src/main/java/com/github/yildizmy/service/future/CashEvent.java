package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single expected movement of money on a future day.
 * <p>
 * Every number the projection shows is the sum of these events, so each one carries
 * where it came from ({@code origin}, {@code reference}) and how certain it is.
 *
 * @param date      day the money is expected to move
 * @param amount    signed amount: positive enters the wallet, negative leaves it
 * @param label     human label, e.g. "Imobiliária Lar Seguro"
 * @param kind      what produced the event
 * @param category  what the money is for, as confirmed by the user (SALARY, RENT…) or implied by the source
 * @param certainty CONFIRMED when the institution or a contract states the value; ESTIMATED when it comes from a
 *                  pattern the user confirmed (bills, everyday spending); HYPOTHETICAL when it only exists in a scenario
 * @param origin    where the data came from, e.g. "Banco Aurora Sandbox · Conta corrente"
 * @param reference stable id used by the UI to open the evidence (pattern key, card id, loan id…)
 */
public record CashEvent(
        LocalDate date,
        BigDecimal amount,
        String label,
        Kind kind,
        String category,
        Certainty certainty,
        String origin,
        String reference
) {

    public enum Kind { INCOME, RECURRING_EXPENSE, CARD_INVOICE, LOAN_INSTALLMENT, DAILY_SPENDING, CARD_SPENDING, GOAL, PLAN, SCENARIO }

    public enum Certainty { CONFIRMED, ESTIMATED, HYPOTHETICAL }

    public boolean isInflow() {
        return amount.signum() > 0;
    }
}
