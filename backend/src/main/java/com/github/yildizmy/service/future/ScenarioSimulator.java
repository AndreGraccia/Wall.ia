package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEvent.Certainty;
import com.github.yildizmy.service.future.CashEvent.Kind;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/**
 * "Modo Futuro": applies a hypothetical decision to a copy of the planned events.
 * Nothing here touches stored data; the result only exists in the response.
 */
public final class ScenarioSimulator {

    private ScenarioSimulator() {
    }

    public static Outcome apply(Scenario scenario, LocalDate today, LocalDate end, List<CashEvent> baseline, List<CardPlan> cards) {
        return switch (scenario.type()) {
            case PURCHASE -> purchase(scenario, today, end, baseline, cards);
            case SAVINGS -> savings(scenario, today, end, baseline);
            case INCOME_LOSS -> incomeLoss(scenario, today, baseline);
            case REFUND -> refund(scenario, today, baseline);
        };
    }

    private static Outcome purchase(Scenario scenario, LocalDate today, LocalDate end, List<CashEvent> baseline, List<CardPlan> cards) {
        List<CashEvent> events = new ArrayList<>(baseline);
        List<BigDecimal> parts = split(scenario.amount(), scenario.installments());
        String label = scenario.label() == null || scenario.label().isBlank() ? "Compra simulada" : scenario.label();
        CardPlan card = scenario.method() == Method.CARD
                ? cards.stream()
                    .filter(item -> scenario.cardId() == null || item.id() == scenario.cardId())
                    .findFirst()
                    .orElse(null)
                : null;

        for (int i = 0; i < parts.size(); i++) {
            LocalDate date;
            String origin;
            if (card != null) {
                YearMonth invoice = card.invoiceFor(today).plusMonths(i);
                date = card.dueDate(invoice);
                origin = card.name();
            } else {
                date = today.plusMonths(i);
                origin = null;
            }
            if (date.isAfter(end)) continue;
            events.add(new CashEvent(
                    date,
                    parts.get(i).negate(),
                    parts.size() == 1 ? label : label + " · " + (i + 1) + "/" + parts.size(),
                    Kind.SCENARIO,
                    "SCENARIO",
                    Certainty.HYPOTHETICAL,
                    origin,
                    "scenario"
            ));
        }
        BigDecimal monthly = parts.size() > 1 ? parts.get(0) : BigDecimal.ZERO;
        return new Outcome(events, monthly, parts.size() > 1 ? parts.size() : 0, card == null ? null : card.name());
    }

    private static Outcome savings(Scenario scenario, LocalDate today, LocalDate end, List<CashEvent> baseline) {
        List<CashEvent> events = new ArrayList<>(baseline);
        int day = scenario.dayOfMonth() == null ? today.getDayOfMonth() : scenario.dayOfMonth();
        for (YearMonth month = YearMonth.from(today); !month.atDay(1).isAfter(end); month = month.plusMonths(1)) {
            LocalDate date = month.atDay(Math.min(day, month.lengthOfMonth()));
            if (date.isBefore(today) || date.isAfter(end)) continue;
            events.add(new CashEvent(date, scenario.amount().negate(), "Guardar todo mês", Kind.SCENARIO,
                    "SCENARIO", Certainty.HYPOTHETICAL, null, "scenario"));
        }
        return new Outcome(events, scenario.amount(), 0, null);
    }

    private static Outcome incomeLoss(Scenario scenario, LocalDate today, List<CashEvent> baseline) {
        LocalDate until = today.plusMonths(scenario.months());
        List<CashEvent> events = baseline.stream()
                .filter(event -> !(event.kind() == Kind.INCOME
                        && event.date().isBefore(until)
                        && (scenario.incomeKey() == null || scenario.incomeKey().equals(event.reference()))))
                .toList();
        return new Outcome(events, BigDecimal.ZERO, 0, null);
    }

    /** Splits cents so the instalments add up exactly to the amount (the remainder goes to the first). */
    private static Outcome refund(Scenario scenario, LocalDate today, List<CashEvent> baseline) {
        List<CashEvent> events = new ArrayList<>(baseline);
        events.add(new CashEvent(today, scenario.amount(), "Estorno hipotético", Kind.SCENARIO,
                "SCENARIO", Certainty.HYPOTHETICAL, null, "hypothetical-refund"));
        return new Outcome(events, BigDecimal.ZERO, 0, null);
    }

    static List<BigDecimal> split(BigDecimal amount, int installments) {
        int count = Math.max(1, installments);
        long cents = amount.movePointRight(2).setScale(0, RoundingMode.HALF_EVEN).longValueExact();
        long base = cents / count;
        long remainder = cents % count;
        List<BigDecimal> parts = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            parts.add(BigDecimal.valueOf(base + (i == 0 ? remainder : 0), 2));
        }
        return parts;
    }

    public enum Type { PURCHASE, SAVINGS, INCOME_LOSS, REFUND }

    public enum Method { CASH, CARD }

    /**
     * @param amount       purchase total or monthly saving
     * @param installments purchase instalments (1 = à vista)
     * @param months       months without the income (INCOME_LOSS)
     * @param incomeKey    which confirmed income to remove; null removes all
     */
    public record Scenario(
            Type type,
            BigDecimal amount,
            int installments,
            Method method,
            Long cardId,
            Integer dayOfMonth,
            int months,
            String incomeKey,
            String label
    ) {
    }

    /**
     * @param newMonthlyCommitment extra money leaving every month because of the decision
     * @param installments         number of instalments created (0 when not applicable)
     * @param cardName             card used for the simulated purchase, when any
     */
    public record Outcome(List<CashEvent> events, BigDecimal newMonthlyCommitment, int installments, String cardName) {
    }
}
