package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CreditCard;
import com.github.yildizmy.domain.entity.Investment;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.dto.request.WealthRequests;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.dto.response.WealthResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.InvestmentRepository;
import com.github.yildizmy.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WealthServiceTest {

    // 01:00 UTC on the 28th is still the 27th in São Paulo.
    private static final Instant NOW = Instant.parse("2026-11-28T01:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);

    private final InvestmentRepository investments = mock(InvestmentRepository.class);
    private final WalletRepository wallets = mock(WalletRepository.class);
    private final CreditCardRepository cards = mock(CreditCardRepository.class);
    private final FutureService futureService = mock(FutureService.class);
    private final UserService users = mock(UserService.class);
    private final WealthService service = new WealthService(investments, wallets, cards, futureService, users,
            Clock.fixed(NOW, ZoneOffset.UTC));

    @BeforeEach
    void nothingOwed() {
        commitments(List.of(), List.of(), List.of());
    }

    @Test
    void netWorthIsAccountsPlusInformedInvestmentsMinusKnownDebtsEachWithOriginAndDate() {
        when(wallets.findByUserId(7L)).thenReturn(List.of(
                wallet(2, "Conta Aurora", "1000.50", WalletSource.OPEN_FINANCE, Instant.parse("2026-11-26T10:00:00Z")),
                wallet(1, "Dinheiro", "99.50", WalletSource.LOCAL, null)));
        when(investments.findByUserIdOrderById(7L)).thenReturn(List.of(
                investment(5, value("2026-10-01", "4000"), value("2026-11-20", "5000"))));
        CreditCard card = new CreditCard();
        card.setId(3L);
        card.setLastSyncedAt(Instant.parse("2026-11-25T12:00:00Z"));
        when(cards.findByUserIdOrderById(7L)).thenReturn(List.of(card));
        commitments(
                List.of(new FutureResponses.Card(3, "Aurora Gold", "Banco Aurora", "1234", money("5000"), money("800"),
                        1, 10, List.of(), null, null, null)),
                List.of(new FutureResponses.Loan(4, "Empréstimo pessoal", "Banco Aurora", money("3000"), money("1500"),
                        money("150"), 20, 10, 10, null, null, null, null, Instant.parse("2026-11-24T12:00:00Z"), null,
                        null, null)),
                List.of(new FutureResponses.ManualDebt(8, "PIX_CREDIT", "Pix do mês", money("200"), money("50"),
                        money("8"), money("151.8"), "MANUAL", "ESTIMATED", Instant.parse("2026-11-01T12:00:00Z"))));

        WealthResponses.Wealth wealth = service.view(7L);

        assertEquals(money("1100.00"), wealth.accountsTotal());
        assertEquals(money("5000.00"), wealth.investmentsTotal(), "the latest informed value, not the sum");
        assertEquals(money("2500.00"), wealth.debtsTotal());
        assertEquals(money("3600.00"), wealth.netWorth());
        assertEquals(TODAY, wealth.accounts().get(0).date(), "a local account is as of today");
        assertEquals(LocalDate.of(2026, 11, 26), wealth.accounts().get(1).date());
        assertEquals(List.of("CARD", "LOAN", "MANUAL"), wealth.debts().stream().map(WealthResponses.Debt::kind).toList());
        assertEquals(List.of(LocalDate.of(2026, 11, 25), LocalDate.of(2026, 11, 24), LocalDate.of(2026, 11, 1)),
                wealth.debts().stream().map(WealthResponses.Debt::date).toList());
        assertTrue(wealth.pixMayRepeatCardBill());
    }

    @Test
    void aPaidOffDebtIsNotListedAndWithoutDataEverythingIsZero() {
        commitments(List.of(new FutureResponses.Card(3, "Aurora", "Banco", null, money("5000"), BigDecimal.ZERO, 1, 10,
                List.of(), null, null, null)), List.of(), List.of());

        WealthResponses.Wealth wealth = service.view(7L);

        assertEquals(money("0.00"), wealth.netWorth());
        assertTrue(wealth.debts().isEmpty());
        assertTrue(wealth.evolution().isEmpty());
        assertFalse(wealth.pixMayRepeatCardBill());
    }

    @Test
    void theEvolutionCarriesEachInvestmentsLastValueForward() {
        when(investments.findByUserIdOrderById(7L)).thenReturn(List.of(
                investment(1, value("2026-09-01", "100"), value("2026-11-01", "150")),
                investment(2, value("2026-10-01", "1000"))));

        assertEquals(List.of(
                new WealthResponses.Point(LocalDate.of(2026, 9, 1), money("100.00")),
                new WealthResponses.Point(LocalDate.of(2026, 10, 1), money("1100.00")),
                new WealthResponses.Point(LocalDate.of(2026, 11, 1), money("1150.00"))), service.view(7L).evolution());
    }

    @Test
    void creatingKeepsTheValueWithItsDateAndClearsBlankNotes() {
        service.create(7L, new WealthRequests.NewInvestment(" Corretora ", " Reserva ", "FIXED_INCOME",
                money("10.5"), TODAY, null, null, "  "));

        ArgumentCaptor<Investment> saved = ArgumentCaptor.forClass(Investment.class);
        verify(investments).save(saved.capture());
        assertEquals("Corretora", saved.getValue().getInstitution());
        assertEquals("Reserva", saved.getValue().getName());
        assertNull(saved.getValue().getNote());
        assertEquals(money("10.50"), saved.getValue().getValues().get(TODAY));
        verify(users).lockForUpdate(7L);
    }

    @Test
    void aFutureDateAndTheLimitAreRefused() {
        var tomorrow = new WealthRequests.NewInvestment("C", "N", "OTHER", money("1"), TODAY.plusDays(1), null, null, null);
        assertEquals("INVESTMENT_FUTURE_DATE", code(() -> service.create(7L, tomorrow)));
        when(investments.countByUserId(7L)).thenReturn((long) WealthService.MAX_INVESTMENTS);
        assertEquals("INVESTMENT_LIMIT", code(() -> service.create(7L,
                new WealthRequests.NewInvestment("C", "N", "OTHER", money("1"), TODAY, null, null, null))));
        verify(investments, never()).save(any());
    }

    @Test
    void aMaturityTheDatabaseCannotHoldIsRefused() {
        assertEquals("INVALID_DATE", code(() -> service.create(7L, new WealthRequests.NewInvestment("C", "N", "OTHER",
                money("1"), TODAY, null, LocalDate.of(999999, 1, 1), null))));
    }

    @Test
    void informingADateAgainCorrectsItAndAWrongOneCanBeRemovedButNotTheLast() {
        Investment investment = investment(5, value("2026-11-01", "100"));
        when(investments.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(investment));
        when(investments.findByUserIdOrderById(7L)).thenReturn(List.of(investment));

        service.putValue(7L, 5L, new WealthRequests.Value(money("120"), LocalDate.of(2026, 11, 1)));
        assertEquals(1, investment.getValues().size());
        var wealth = service.putValue(7L, 5L, new WealthRequests.Value(money("90"), LocalDate.of(2026, 10, 1)));
        assertEquals(money("120.00"), wealth.investments().get(0).value(), "an older date does not replace the current value");

        assertEquals("INVESTMENT_VALUE_NOT_FOUND", code(() -> service.deleteValue(7L, 5L, TODAY)));
        service.deleteValue(7L, 5L, LocalDate.of(2026, 10, 1));
        assertEquals("INVESTMENT_LAST_VALUE", code(() -> service.deleteValue(7L, 5L, LocalDate.of(2026, 11, 1))));
        assertEquals(1, investment.getValues().size());
    }

    @Test
    void theHistoryHasALimit() {
        Investment investment = investment(5);
        for (int i = 0; i < WealthService.MAX_VALUES; i++) {
            investment.getValues().put(TODAY.minusDays(i + 1), money("1"));
        }
        when(investments.findByIdAndUserId(5L, 7L)).thenReturn(Optional.of(investment));

        assertEquals("INVESTMENT_VALUE_LIMIT",
                code(() -> service.putValue(7L, 5L, new WealthRequests.Value(money("2"), TODAY))));
    }

    @Test
    void someoneElsesInvestmentIsNotFoundOnEveryChange() {
        when(investments.findByIdAndUserId(5L, 8L)).thenReturn(Optional.empty());
        assertEquals("INVESTMENT_NOT_FOUND", code(() -> service.update(8L, 5L,
                new WealthRequests.Details("C", "N", "OTHER", null, null, null))));
        assertEquals("INVESTMENT_NOT_FOUND",
                code(() -> service.putValue(8L, 5L, new WealthRequests.Value(money("1"), TODAY))));
        assertEquals("INVESTMENT_NOT_FOUND", code(() -> service.deleteValue(8L, 5L, TODAY)));
        assertEquals("INVESTMENT_NOT_FOUND", code(() -> service.delete(8L, 5L)));
        verify(investments, never()).delete(any());
    }

    /** The rule of ADR 0026: what is typed here never reaches the available balance or the projection. */
    @Test
    void nothingThatComputesBalanceOrProjectionCanReadInvestments() {
        for (Class<?> type : List.of(FutureService.class, MonthPlanService.class, ForecastService.class,
                FutureAlertService.class, InsightsService.class)) {
            assertTrue(Arrays.stream(type.getDeclaredFields())
                    .noneMatch(field -> field.getType() == InvestmentRepository.class), type.getSimpleName());
        }
    }

    private void commitments(List<FutureResponses.Card> owedCards, List<FutureResponses.Loan> loans,
                             List<FutureResponses.ManualDebt> manual) {
        when(futureService.commitments(7L)).thenReturn(new FutureResponses.Commitments(owedCards, loans, manual, null));
    }

    private static String code(Runnable call) {
        return assertThrows(WalletRuleException.class, call::run).getMessage();
    }

    private static BigDecimal money(String amount) {
        return new BigDecimal(amount);
    }

    private static Wallet wallet(long id, String name, String balance, WalletSource source, Instant syncedAt) {
        Wallet wallet = new Wallet();
        wallet.setId(id);
        wallet.setIban("TR" + id);
        wallet.setName(name);
        wallet.setBalance(money(balance));
        wallet.setSource(source);
        wallet.setLastSyncedAt(syncedAt);
        return wallet;
    }

    private record Value(String date, String amount) {
    }

    private static Value value(String date, String amount) {
        return new Value(date, amount);
    }

    private static Investment investment(long id, Value... values) {
        Investment investment = new Investment();
        investment.setId(id);
        investment.setInstitution("Corretora");
        investment.setName("Aplicação " + id);
        investment.setAssetClass("OTHER");
        for (Value value : values) {
            investment.getValues().put(LocalDate.parse(value.date()), money(value.amount()).setScale(2));
        }
        return investment;
    }
}
