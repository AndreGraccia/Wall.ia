package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.ChargeAlertDecision;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Type;
import com.github.yildizmy.domain.entity.User;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.ChargeAlertDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ChargeAlertServiceTest {

    private static final long USER_ID = 7L;
    private static final Instant NOW = Instant.parse("2026-10-26T15:00:00Z");

    private TransactionRepository transactions;
    private ChargeAlertDecisionRepository decisions;
    private UserService users;
    private ChargeAlertService service;

    @BeforeEach
    void setUp() {
        transactions = mock(TransactionRepository.class);
        decisions = mock(ChargeAlertDecisionRepository.class);
        users = mock(UserService.class);
        service = new ChargeAlertService(transactions, decisions, users,
                Clock.fixed(NOW, ZoneId.of("America/Sao_Paulo")));
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(List.of());
        when(decisions.findByUser_IdAndTransaction_IdIn(eq(USER_ID), anyCollection())).thenReturn(List.of());
    }

    @Test
    void sameMerchantAndAmountWithinFortyEightHoursIsAReviewPromptNotAConclusion() {
        Transaction first = withdrawal(10L, "NETFLIX BRASIL", "39.90", "2026-10-24T14:00:00Z", USER_ID, "4821");
        Transaction repeated = withdrawal(11L, "Netflix Brasil", "39.90", "2026-10-25T14:00:00Z", USER_ID, "4821");
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(List.of(repeated, first));

        var result = service.findForUser(USER_ID);

        assertEquals(1, result.size());
        assertEquals(11L, result.get(0).transactionId());
        assertEquals("POSSIBLE_DUPLICATE", result.get(0).kind());
        assertEquals("HIGH", result.get(0).confidence());
        assertEquals(10L, result.get(0).relatedTransactionId());
        assertEquals(new BigDecimal("39.90"), result.get(0).amount());
        assertTrue(result.get(0).date().isAfter(result.get(0).relatedDate()));
    }

    @Test
    void anAmountAboveOneHundredAndFiftyPercentOfThreePriorChargesIsFlagged() {
        List<Transaction> history = List.of(
                withdrawal(1L, "ACADEMIA MOVE", "100.00", "2026-07-01T14:00:00Z", USER_ID, "4821"),
                withdrawal(2L, "Academia Move", "100.00", "2026-08-01T14:00:00Z", USER_ID, "4821"),
                withdrawal(3L, "ACADEMIA MOVE", "100.00", "2026-09-01T14:00:00Z", USER_ID, "4821"),
                withdrawal(4L, "Academia Move", "180.00", "2026-10-20T14:00:00Z", USER_ID, "4821")
        );
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(history);

        var result = service.findForUser(USER_ID);

        assertEquals(1, result.size());
        assertEquals(4L, result.get(0).transactionId());
        assertEquals("UNUSUAL_AMOUNT", result.get(0).kind());
        assertEquals("MEDIUM", result.get(0).confidence());
        assertEquals(new BigDecimal("100.00"), result.get(0).baselineAmount());
        assertEquals(new BigDecimal("80.00"), result.get(0).difference());
        assertEquals(3, result.get(0).occurrences());
    }

    @Test
    void samePriceMonthlyIsNotTreatedAsADuplicate() {
        List<Transaction> history = List.of(
                withdrawal(1L, "NETFLIX BRASIL", "39.90", "2026-08-01T14:00:00Z", USER_ID, "4821"),
                withdrawal(2L, "NETFLIX BRASIL", "39.90", "2026-09-01T14:00:00Z", USER_ID, "4821"),
                withdrawal(3L, "NETFLIX BRASIL", "39.90", "2026-10-01T14:00:00Z", USER_ID, "4821")
        );
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(history);

        assertTrue(service.findForUser(USER_ID).isEmpty());
    }

    @Test
    void localTransactionsAndKnownInterAccountTransfersAreNeverFlagged() {
        Transaction local = withdrawal(1L, "ACADEMIA MOVE", "90.00", "2026-10-24T14:00:00Z", USER_ID, "4821");
        local.setSource(TransactionSource.LOCAL);
        Transaction transfer = withdrawal(2L, "Transferencia entre minhas contas", "90.00",
                "2026-10-25T14:00:00Z", USER_ID, "4821");
        transfer.setPaymentType("TRANSFERENCIA_MESMA_INSTITUICAO");
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(List.of(local, transfer));

        assertTrue(service.findForUser(USER_ID).isEmpty());
    }

    @Test
    void feedbackHidesDismissedAlertsButKeepsItemsMarkedForReview() {
        Transaction first = withdrawal(10L, "NETFLIX BRASIL", "39.90", "2026-10-24T14:00:00Z", USER_ID, "4821");
        Transaction repeated = withdrawal(11L, "Netflix Brasil", "39.90", "2026-10-25T14:00:00Z", USER_ID, "4821");
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(List.of(first, repeated));

        ChargeAlertDecision decision = new ChargeAlertDecision();
        decision.setTransaction(repeated);
        decision.setDecision("REVIEW");
        when(decisions.findByUser_IdAndTransaction_IdIn(eq(USER_ID), anyCollection())).thenReturn(List.of(decision));

        var result = service.findForUser(USER_ID);

        assertEquals(1, result.size());
        assertEquals("REVIEW", result.get(0).decision());

        decision.setDecision("NOT_ANOMALOUS");
        assertTrue(service.findForUser(USER_ID).isEmpty());
    }

    @Test
    void invalidFeedbackAndTransactionsOutsideTheCallersHistoryAreRejected() {
        assertThrows(WalletRuleException.class, () -> service.decide(USER_ID, 99L, "MOVE_MONEY"));
        verify(decisions, never()).save(any(ChargeAlertDecision.class));
        verifyNoInteractions(users);
    }

    @Test
    void feedbackIsStoredAgainstTheAuthenticatedUsersOwnDetectedTransaction() {
        User user = new User();
        user.setId(USER_ID);
        when(users.getReferenceById(USER_ID)).thenReturn(user);
        Transaction first = withdrawal(10L, "NETFLIX BRASIL", "39.90", "2026-10-24T14:00:00Z", USER_ID, "4821");
        Transaction repeated = withdrawal(11L, "Netflix Brasil", "39.90", "2026-10-25T14:00:00Z", USER_ID, "4821");
        when(transactions.findAllByUserIdSince(eq(USER_ID), any(Instant.class))).thenReturn(List.of(first, repeated));
        when(decisions.findByUser_IdAndTransaction_Id(USER_ID, 11L)).thenReturn(Optional.empty());

        service.decide(USER_ID, 11L, "RESOLVED");

        var captor = org.mockito.ArgumentCaptor.forClass(ChargeAlertDecision.class);
        verify(decisions).save(captor.capture());
        assertEquals(USER_ID, captor.getValue().getUser().getId());
        assertEquals(11L, captor.getValue().getTransaction().getId());
        assertEquals("RESOLVED", captor.getValue().getDecision());
        assertEquals(NOW, captor.getValue().getCreatedAt());
        assertEquals(NOW, captor.getValue().getUpdatedAt());
    }

    private static Transaction withdrawal(
            long id, String description, String amount, String createdAt, long userId, String ibanSuffix) {
        User owner = new User();
        owner.setId(userId);
        Wallet wallet = new Wallet();
        wallet.setId(100L + userId);
        wallet.setName("Conta principal");
        wallet.setInstitutionName("Banco de demonstração");
        wallet.setIban("BR0000000000000000000000" + ibanSuffix);
        wallet.setSource(WalletSource.OPEN_FINANCE);
        wallet.setUser(owner);

        Type type = new Type();
        type.setId(2L);
        type.setName("Withdrawal");

        Transaction transaction = new Transaction();
        transaction.setId(id);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setDescription(description);
        transaction.setCreatedAt(Instant.parse(createdAt));
        transaction.setStatus(Status.SUCCESS);
        transaction.setSource(TransactionSource.OPEN_FINANCE);
        transaction.setFromWallet(wallet);
        transaction.setType(type);
        return transaction;
    }
}
