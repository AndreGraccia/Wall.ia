package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.MonthFlow.Group;
import com.github.yildizmy.service.future.MonthFlow.Line;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Entradas e saídas (ADR 0021): totals of one month by account, payment method and category, in cash regime. */
class MonthFlowTest {

    private long ids = 1;

    private Line line(String date, String amount, Direction direction, String counterparty, String account,
                      String institution, String paymentType) {
        return new Line(new Movement(ids++, LocalDate.parse(date), new BigDecimal(amount), direction, counterparty,
                account, institution), paymentType);
    }

    private static BigDecimal total(List<Group> groups, String key) {
        return groups.stream().filter(group -> group.key().equals(key)).map(Group::total).findFirst().orElse(null);
    }

    @Test
    void incomeAndSpendingAreGroupedByAccountMethodAndCategory() {
        List<Line> lines = List.of(
                line("2026-11-05", "5000.00", Direction.IN, "Empresa X", "Banco Aurora • 1234", "Banco Aurora", "TED"),
                line("2026-11-10", "1500.00", Direction.OUT, "Imobiliária Lar", "Banco Aurora • 1234", "Banco Aurora", "BOLETO"),
                line("2026-11-12", "80.00", Direction.OUT, "Mercado Bom", "Banco Aurora • 1234", "Banco Aurora", "PIX"),
                line("2026-11-13", "40.00", Direction.OUT, "Padaria", "Carteira", null, null),
                line("2026-11-14", "300.00", Direction.IN, "Transferência recebida", "Carteira", null, null));

        MonthFlow.Result result = MonthFlow.of(lines, Map.of("in:empresa-x", "SALARY", "out:imobiliaria-lar", "RENT"),
                Set.of(), List.of());

        assertEquals(new BigDecimal("5300.00"), result.income().total());
        assertEquals(new BigDecimal("1620.00"), result.spending().total());
        assertEquals(new BigDecimal("5000.00"), total(result.income().byCategory(), "SALARY"));
        assertEquals(new BigDecimal("300.00"), total(result.income().byCategory(), "UNCLASSIFIED"));
        assertEquals(new BigDecimal("1500.00"), total(result.spending().byCategory(), "RENT"));
        assertEquals(new BigDecimal("120.00"), total(result.spending().byCategory(), "EVERYDAY"));
        assertEquals(new BigDecimal("1580.00"), total(result.spending().byAccount(), "Banco Aurora • 1234"),
                "the account name already carries the institution, so it is not repeated");
        assertEquals(new BigDecimal("40.00"), total(result.spending().byAccount(), "Carteira"));
        assertEquals(new BigDecimal("80.00"), total(result.spending().byMethod(), "PIX"));
        assertEquals(new BigDecimal("40.00"), total(result.spending().byMethod(), MonthFlow.UNKNOWN_METHOD));
        assertEquals(new BigDecimal("120.00"), result.everyday());
    }

    @Test
    void itemsCarryTheGroupKeysNewestFirstSoTheListFiltersLikeTheGroups() {
        List<Line> lines = List.of(
                line("2026-11-03", "80.00", Direction.OUT, "Mercado", "Conta", "Banco", "PIX"),
                line("2026-11-12", "45.00", Direction.OUT, "Farmácia", "Conta", "Banco", null),
                line("2026-11-05", "5000.00", Direction.IN, "Empresa X", "Conta", "Banco", "TED"));

        MonthFlow.Result result = MonthFlow.of(lines, Map.of(), Set.of(), List.of());

        List<MonthFlow.Item> spent = result.spending().items();
        assertEquals(List.of("Farmácia", "Mercado"), spent.stream().map(MonthFlow.Item::counterparty).toList());
        assertEquals(MonthFlow.UNKNOWN_METHOD, spent.get(0).method());
        assertEquals(result.spending().byAccount().get(0).key(), spent.get(0).account());
        assertEquals(result.spending().total(),
                spent.stream().map(MonthFlow.Item::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
        for (MonthFlow.Item item : spent)
            assertTrue(result.spending().byCategory().stream().anyMatch(group -> group.key().equals(item.category())));
        assertEquals(1, result.income().items().size());
    }

    @Test
    void groupsComeLargestFirst() {
        List<Line> lines = List.of(
                line("2026-11-12", "80.00", Direction.OUT, "Mercado", "Conta", "Banco", "PIX"),
                line("2026-11-13", "300.00", Direction.OUT, "Loja", "Conta", "Banco", "BOLETO"));

        MonthFlow.Result result = MonthFlow.of(lines, Map.of(), Set.of(), List.of());

        assertEquals(List.of("BOLETO", "PIX"), result.spending().byMethod().stream().map(Group::key).toList());
        assertEquals(List.of("Banco · Conta"), result.spending().byAccount().stream().map(Group::key).toList());
    }

    @Test
    void theCardBillLoansAndUnansweredRecurrencesAreSpendingButNotEveryday() {
        CardPlan card = new CardPlan(1, "Cartão", "Banco", 3, 10, List.of(new CardPlan.Charge(1, "Loja",
                LocalDate.parse("2026-10-01"), new BigDecimal("700.00"), new BigDecimal("700.00"), 1, YearMonth.of(2026, 11))));
        List<Line> lines = List.of(
                line("2026-11-10", "700.00", Direction.OUT, "NU PAGAMENTOS SA", "Conta", "Banco", "BOLETO"),
                line("2026-11-11", "450.00", Direction.OUT, "Parcela emprestimo", "Conta", "Banco", "BOLETO"),
                line("2026-11-15", "200.00", Direction.OUT, "Academia", "Conta", "Banco", "PIX"),
                line("2026-11-16", "50.00", Direction.OUT, "Farmácia", "Conta", "Banco", "PIX"));

        MonthFlow.Result result = MonthFlow.of(lines, Map.of(), Set.of("out:academia"), List.of(card));

        assertEquals(new BigDecimal("700.00"), total(result.spending().byCategory(), "CARD_INVOICE"));
        assertEquals(new BigDecimal("450.00"), total(result.spending().byCategory(), "LOAN"));
        assertEquals(new BigDecimal("200.00"), total(result.spending().byCategory(), "UNCONFIRMED_RECURRENCE"));
        assertEquals(new BigDecimal("50.00"), result.everyday(), "only the pharmacy is everyday spending");
        assertEquals(new BigDecimal("1400.00"), result.spending().total());
    }

    @Test
    void anEmptyMonthIsZerosAndEmptyLists() {
        MonthFlow.Result result = MonthFlow.of(List.of(), Map.of(), Set.of(), List.of());

        assertEquals(BigDecimal.ZERO, result.income().total());
        assertEquals(List.of(), result.spending().byCategory());
        assertEquals(BigDecimal.ZERO, result.everyday());
    }
}
