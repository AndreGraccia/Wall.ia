package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Envelope;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.dto.request.FutureRequests;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FutureEnvelopesTest {

    private final WalletRepository wallets = mock(WalletRepository.class);
    private final EnvelopeRepository envelopes = mock(EnvelopeRepository.class);
    private final FutureService service = new FutureService(
            wallets, mock(TransactionRepository.class), mock(RecurrenceDecisionRepository.class),
            mock(CreditCardRepository.class), mock(LoanRepository.class), mock(GoalRepository.class), envelopes,
            mock(com.github.yildizmy.repository.ManualDebtRepository.class), mock(com.github.yildizmy.repository.MonthPlanRepository.class), mock(UserService.class), mock(com.github.yildizmy.service.market.MarketRatesService.class), mock(CategoryResolver.class), Clock.fixed(Instant.parse("2026-09-24T15:00:00Z"), ZoneOffset.UTC));

    @Test
    void theDailyLimitLeavesTheEnvelopesUntouchedButTheProjectionKeepsTheRealBalance() {
        balance("1000.00");
        envelopes(envelope("Viagem", "400.00"));

        FutureResponses.Overview overview = service.overview(7L, 30);

        assertEquals(new BigDecimal("1000.00"), overview.balance());
        assertEquals(new BigDecimal("400.00"), overview.reserved());
        assertEquals(new BigDecimal("600.00"), overview.freeAfterCommitments());
        // No income known: 29 spending days from tomorrow; 600 / 29 rounded down.
        assertEquals(new BigDecimal("20.68"), overview.spendingLimit().safeDaily());
        assertEquals(0, overview.projection().minBalance().compareTo(new BigDecimal("1000.00")));
    }

    @Test
    void anEnvelopeBiggerThanTheMoneyIsShownAsUnbacked() {
        balance("300.00");
        envelopes(envelope("Reserva", "500.00"));

        FutureResponses.Envelopes result = service.envelopes(7L);

        assertEquals(new BigDecimal("500.00"), result.reserved());
        assertEquals(new BigDecimal("200.00"), result.unbacked());
        FutureResponses.Overview overview = service.overview(7L, 30);
        assertEquals(new BigDecimal("200.00"), overview.spendingLimit().shortfall());
    }

    @Test
    void tenEnvelopesIsTheLimitAndAnotherUsersEnvelopeIsNotFound() {
        when(envelopes.countByUserId(7L)).thenReturn(10L);
        assertThrows(WalletRuleException.class, () -> service.createEnvelope(7L,
                new FutureRequests.Envelope("IPVA", new BigDecimal("900.00"))));
        verify(envelopes, never()).save(any(Envelope.class));

        when(envelopes.findByIdAndUserId(99L, 7L)).thenReturn(Optional.empty());
        assertThrows(WalletRuleException.class, () -> service.deleteEnvelope(7L, 99L));
        verify(envelopes, never()).delete(any());
    }

    private void balance(String value) {
        Wallet wallet = new Wallet();
        wallet.setId(1L);
        wallet.setBalance(new BigDecimal(value));
        when(wallets.findByUserId(7L)).thenReturn(List.of(wallet));
    }

    private void envelopes(Envelope... items) {
        when(envelopes.findByUserIdOrderById(7L)).thenReturn(List.of(items));
    }

    private static Envelope envelope(String name, String amount) {
        Envelope envelope = new Envelope();
        envelope.setId(1L);
        envelope.setName(name);
        envelope.setAmount(new BigDecimal(amount));
        return envelope;
    }
}
