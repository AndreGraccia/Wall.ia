package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Type;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.insight.GeneratedNarrative;
import com.github.yildizmy.service.insight.InsightNarrativeGenerator;
import com.github.yildizmy.service.insight.InsightRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InsightsServiceTest {
    @Mock private TransactionRepository transactionRepository;
    @Mock private WalletRepository walletRepository;
    @Mock private InsightNarrativeGenerator narrativeGenerator;
    @Mock private InsightRateLimiter rateLimiter;

    private InsightsService service;
    private Wallet primary;
    private Wallet reserve;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-09-20T12:00:00Z"), ZoneOffset.UTC);
        service = new InsightsService(transactionRepository, walletRepository, narrativeGenerator, rateLimiter, clock,
                org.springframework.transaction.support.TransactionOperations.withoutTransaction());
        primary = wallet(1L);
        reserve = wallet(2L);
        // Lenient: the pairing tests call the rule directly, without a user.
        org.mockito.Mockito.lenient().when(walletRepository.findByUserId(7L)).thenReturn(List.of(primary, reserve));
    }

    @Test
    void aggregatesCashFlowWithoutCountingInternalTransfersAsIncomeOrSpending() {
        when(narrativeGenerator.isEnabled()).thenReturn(false);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of(
                transaction("100.00", "Deposit", primary, primary, "2026-07-03T10:00:00Z", Status.SUCCESS),
                transaction("25.00", "Withdrawal", primary, primary, "2026-08-04T10:00:00Z", Status.SUCCESS),
                transaction("10.00", "Transfer", primary, reserve, "2026-09-05T10:00:00Z", Status.SUCCESS),
                transaction("50.00", "Deposit", primary, primary, "2026-09-05T10:00:00Z", Status.ERROR),
                transaction("90.00", "Deposit", primary, primary, "2026-06-30T23:59:59Z", Status.SUCCESS)
        ));

        var report = service.generate(7L, 3, "pt-BR");

        assertEquals("LOCAL", report.provider());
        assertEquals(new BigDecimal("100.00"), report.metrics().inflow());
        assertEquals(new BigDecimal("25.00"), report.metrics().outflow());
        assertEquals(new BigDecimal("10.00"), report.metrics().internalTransfers());
        assertEquals(new BigDecimal("75.00"), report.metrics().netFlow());
        assertEquals(3, report.metrics().transactionCount());
        assertEquals(List.of("2026-07", "2026-08", "2026-09"),
                report.monthlyFlow().stream().map(item -> item.month()).toList());
        verify(rateLimiter, never()).check(any());
    }

    @Test
    void usesAiNarrativeWhenConfiguredButKeepsServerCalculatedMetricsAndReferences() {
        when(narrativeGenerator.isEnabled()).thenReturn(true);
        when(rateLimiter.tryGlobal()).thenReturn(true);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of());
        var generated = new GeneratedNarrative(
                "Leitura personalizada",
                "Resumo seguro.",
                List.of(new GeneratedNarrative.NarrativeItem("Observação", "Texto", "neutral", List.of("BCB_EDUCACAO"))),
                List.of());
        when(narrativeGenerator.generate(any(), eq("pt-BR"), any(Map.class))).thenReturn(Optional.of(generated));

        var report = service.generate(7L, 1, "pt-BR");

        assertEquals("GEMINI", report.provider());
        assertEquals("Leitura personalizada", report.headline());
        assertEquals(6, report.references().size());
        verify(rateLimiter).check(7L);
    }

    @Test
    void fallsBackToLocalAnalysisWhenTheSharedGeminiBudgetIsUsedUp() {
        when(narrativeGenerator.isEnabled()).thenReturn(true);
        when(rateLimiter.tryGlobal()).thenReturn(false);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of());

        var report = service.generate(7L, 1, "pt-BR");

        assertEquals("LOCAL", report.provider());
        verify(narrativeGenerator, never()).generate(any(), any(), any(Map.class));
    }

    @Test
    void moveBetweenOwnImportedAccountsIsNeitherIncomeNorSpending() {
        when(narrativeGenerator.isEnabled()).thenReturn(false);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of(
                imported(transaction("300.00", "Withdrawal", primary, primary, "2026-09-05T13:00:00Z", Status.SUCCESS), "TRANSFERENCIA_MESMA_INSTITUICAO"),
                imported(transaction("300.00", "Deposit", reserve, reserve, "2026-09-05T13:00:05Z", Status.SUCCESS), "TRANSFERENCIA_MESMA_INSTITUICAO"),
                transaction("40.00", "Withdrawal", primary, primary, "2026-09-06T13:00:00Z", Status.SUCCESS)
        ));

        var report = service.generate(7L, 1, "pt-BR");

        assertEquals(new BigDecimal("0.00"), report.metrics().inflow());
        assertEquals(new BigDecimal("40.00"), report.metrics().outflow());
        assertEquals(new BigDecimal("300.00"), report.metrics().internalTransfers());
    }

    @Test
    void sameValueSameDayIsNotATransferWhenOneSideIsNotAMove() {
        when(narrativeGenerator.isEnabled()).thenReturn(false);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of(
                // A card bill paid by boleto and a Pix received in the other account: unrelated, same value and day.
                imported(transaction("500.00", "Withdrawal", primary, primary, "2026-09-05T13:00:00Z", Status.SUCCESS), "BOLETO"),
                imported(transaction("500.00", "Deposit", reserve, reserve, "2026-09-05T15:00:00Z", Status.SUCCESS), "PIX"),
                // Typed by hand: never paired, whatever the value.
                transaction("80.00", "Withdrawal", primary, primary, "2026-09-06T13:00:00Z", Status.SUCCESS),
                transaction("80.00", "Deposit", reserve, reserve, "2026-09-06T13:00:00Z", Status.SUCCESS)
        ));

        var report = service.generate(7L, 1, "pt-BR");

        assertEquals(new BigDecimal("580.00"), report.metrics().inflow());
        assertEquals(new BigDecimal("580.00"), report.metrics().outflow());
        assertEquals(new BigDecimal("0.00"), report.metrics().internalTransfers());
    }

    @Test
    void importsFromBeforeTheTypeWasStoredStillPair() {
        when(narrativeGenerator.isEnabled()).thenReturn(false);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of(
                imported(transaction("300.00", "Withdrawal", primary, primary, "2026-09-05T13:00:00Z", Status.SUCCESS), null),
                imported(transaction("300.00", "Deposit", reserve, reserve, "2026-09-05T13:00:05Z", Status.SUCCESS), null)
        ));

        var report = service.generate(7L, 1, "pt-BR");

        assertEquals(new BigDecimal("300.00"), report.metrics().internalTransfers());
    }

    @Test
    void moreThanOnePossiblePartnerWithoutEvidenceHidesNothing() {
        // One Pix sent, two unrelated Pix received in the other account, same value and day: which one is the pair?
        var moves = List.of(
                move("Withdrawal", primary, "Pix enviado Joao", "PIX"),
                move("Deposit", reserve, "Pix recebido Marina", "PIX"),
                move("Deposit", reserve, "Pix recebido Carlos", "PIX"));

        assertEquals(0, InsightsService.ownAccountPairs(moves).size());
    }

    @Test
    void theSameDescriptionOnBothSidesPicksTheRealPairAndLeavesTheStrangerVisible() {
        // The sandbox reserve move, with an unrelated Pix of the same value on the same day.
        Transaction out = move("Withdrawal", primary, "Transferência para reserva", "TRANSFERENCIA_MESMA_INSTITUICAO");
        Transaction in = move("Deposit", reserve, "Transferência para reserva", "TRANSFERENCIA_MESMA_INSTITUICAO");
        Transaction stranger = move("Deposit", reserve, "Marina Souza", "PIX");

        var pairs = InsightsService.ownAccountPairs(List.of(stranger, out, in));

        assertEquals(2, pairs.size());
        assertEquals(false, pairs.contains(stranger));
    }

    @Test
    void twoIdenticalMovesWithBothSidesAreAllInternalButAnExtraSideMakesThemAmbiguous() {
        var both = new java.util.ArrayList<>(List.of(
                move("Withdrawal", primary, "Reserva", "PIX"), move("Withdrawal", primary, "Reserva", "PIX"),
                move("Deposit", reserve, "Reserva", "PIX"), move("Deposit", reserve, "Reserva", "PIX")));
        assertEquals(4, InsightsService.ownAccountPairs(both).size());

        both.add(move("Deposit", reserve, "Reserva", "PIX"));
        assertEquals(0, InsightsService.ownAccountPairs(both).size());
    }

    @Test
    void differentPaymentTypesAndScheduledSidesDoNotPair() {
        assertEquals(0, InsightsService.ownAccountPairs(List.of(
                move("Withdrawal", primary, "Enviado", "PIX"),
                move("Deposit", reserve, "Recebido", "TED"))).size());
        Transaction scheduled = move("Deposit", reserve, "Reserva", "PIX");
        scheduled.setStatus(Status.PENDING);
        assertEquals(0, InsightsService.ownAccountPairs(List.of(
                move("Withdrawal", primary, "Reserva", "PIX"), scheduled)).size());
    }

    private Transaction move(String typeName, Wallet wallet, String description, String paymentType) {
        Transaction transaction = imported(
                transaction("300.00", typeName, wallet, wallet, "2026-09-05T13:00:00Z", Status.SUCCESS), paymentType);
        transaction.setDescription(description);
        return transaction;
    }

    private Transaction imported(Transaction transaction, String paymentType) {
        transaction.setSource(com.github.yildizmy.domain.enums.TransactionSource.OPEN_FINANCE);
        transaction.setPaymentType(paymentType);
        return transaction;
    }

    @Test
    void monthClosesInBrasiliaTime() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-01T02:00:00Z"), ZoneOffset.UTC); // 30/09, 23h in Brasília
        service = new InsightsService(transactionRepository, walletRepository, narrativeGenerator, rateLimiter, clock,
                org.springframework.transaction.support.TransactionOperations.withoutTransaction());
        when(narrativeGenerator.isEnabled()).thenReturn(false);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of(
                transaction("70.00", "Deposit", primary, primary, "2026-10-01T01:30:00Z", Status.SUCCESS)));

        var report = service.generate(7L, 1, "pt-BR");

        assertEquals(List.of("2026-09"), report.monthlyFlow().stream().map(item -> item.month()).toList());
        assertEquals(new BigDecimal("70.00"), report.metrics().inflow());
    }

    @Test
    void theAiCallHappensAfterTheDatabaseTransactionEnds() {
        boolean[] inTransaction = {false};
        service = new InsightsService(transactionRepository, walletRepository, narrativeGenerator, rateLimiter,
                Clock.fixed(Instant.parse("2026-09-20T12:00:00Z"), ZoneOffset.UTC),
                new org.springframework.transaction.support.TransactionOperations() {
                    @Override
                    public <T> T execute(org.springframework.transaction.support.TransactionCallback<T> action) {
                        inTransaction[0] = true;
                        try {
                            return action.doInTransaction(null);
                        } finally {
                            inTransaction[0] = false;
                        }
                    }
                });
        when(narrativeGenerator.isEnabled()).thenReturn(true);
        when(rateLimiter.tryGlobal()).thenReturn(true);
        when(transactionRepository.findAllByUserIdSince(eq(7L), any())).thenReturn(List.of());
        when(narrativeGenerator.generate(any(), any(), any(Map.class))).thenAnswer(invocation -> {
            org.junit.jupiter.api.Assertions.assertFalse(inTransaction[0], "no connection held during the AI call");
            return Optional.empty();
        });

        service.generate(7L, 1, "pt-BR");

        verify(narrativeGenerator).generate(any(), any(), any(Map.class));
    }

    private Wallet wallet(Long id) {
        Wallet wallet = new Wallet();
        wallet.setId(id);
        wallet.setIban("BR0000000000000" + id);
        return wallet;
    }

    private Transaction transaction(
            String amount,
            String typeName,
            Wallet from,
            Wallet to,
            String createdAt,
            Status status
    ) {
        Type type = new Type();
        type.setName(typeName);
        Transaction transaction = new Transaction();
        transaction.setAmount(new BigDecimal(amount));
        transaction.setType(type);
        transaction.setFromWallet(from);
        transaction.setToWallet(to);
        transaction.setCreatedAt(Instant.parse(createdAt));
        transaction.setStatus(status);
        return transaction;
    }
}
