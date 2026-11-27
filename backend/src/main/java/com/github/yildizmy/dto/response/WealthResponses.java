package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Patrimônio (ADR 0026): every part with its origin and date. */
public final class WealthResponses {

    private WealthResponses() {
    }

    /**
     * @param netWorth             accounts + investments - debts
     * @param evolution            total of the informed investments on each date that has a value; not net worth
     * @param pixMayRepeatCardBill a typed "Pix no crédito" and a card bill coexist: its instalment may be on the bill
     */
    public record Wealth(LocalDate today, BigDecimal netWorth, BigDecimal accountsTotal, BigDecimal investmentsTotal,
                         BigDecimal debtsTotal, List<Account> accounts, List<Investment> investments, List<Debt> debts,
                         List<Point> evolution, boolean pixMayRepeatCardBill) {
    }

    /**
     * @param origin OPEN_FINANCE or LOCAL (an account kept in Wall.ia)
     * @param date   last sync; today for a local account; null when a bank account never synced
     */
    public record Account(long id, String name, String institution, String origin, BigDecimal balance, LocalDate date) {
    }

    /** Typed by the person: origin MANUAL, certainty ESTIMATED. */
    public record Investment(long id, String institution, String name, String assetClass, BigDecimal value,
                             LocalDate valueDate, BigDecimal investedAmount, LocalDate maturityDate, String note,
                             List<Point> history) {
    }

    /**
     * @param kind        CARD (invoices not yet due, early payments taken out), LOAN (outstanding balance) or
     *                    MANUAL (typed by the person)
     * @param institution null for a typed debt
     * @param date        last sync of the card or loan, or when the debt was typed
     */
    public record Debt(String kind, long id, String name, String institution, BigDecimal amount, LocalDate date) {
    }

    public record Point(LocalDate date, BigDecimal amount) {
    }
}
