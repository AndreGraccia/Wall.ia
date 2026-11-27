package com.github.yildizmy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Category rules (ADR 0024). */
public final class CategoryResponses {

    private CategoryResponses() {
    }

    /**
     * @param side        "income" or "spending", the sides of Entradas e saídas
     * @param appliesFrom first date the rule reaches; null when it reaches the previous entries too
     */
    public record Rule(long id, String counterparty, String side, String category, LocalDate appliesFrom) {
    }

    /**
     * What saving the rule would do, over the history Entradas e saídas reads. Nothing is saved.
     *
     * @param affected how many entries would take the category from the rule
     * @param kept     entries in scope that keep a different category picked one by one
     * @param replaces category of the rule this one would replace, null when there is none
     * @param items    the affected entries, newest first, at most 50
     */
    public record Preview(String counterparty, String category, int affected, int kept, String replaces,
                          List<Entry> items) {
    }

    public record Entry(long id, LocalDate date, BigDecimal amount, String account) {
    }
}
