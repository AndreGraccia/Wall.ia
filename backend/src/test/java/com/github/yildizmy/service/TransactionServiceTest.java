package com.github.yildizmy.service;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.dto.mapper.TransactionRequestMapper;
import com.github.yildizmy.dto.mapper.TransactionResponseMapper;
import com.github.yildizmy.dto.request.TransactionRequest;
import com.github.yildizmy.dto.response.TransactionResponse;
import com.github.yildizmy.exception.NoSuchElementFoundException;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @InjectMocks
    private TransactionService transactionService;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private TransactionRequestMapper transactionRequestMapper;

    @Mock
    private TransactionResponseMapper transactionResponseMapper;

    @Mock
    private MessageSourceConfig messageConfig;

    private Transaction testTransaction;
    private TransactionResponse testTransactionResponse;

    @BeforeEach
    void setUp() {
        testTransaction = new Transaction();
        testTransaction.setId(1L);
        testTransaction.setReferenceNumber(UUID.randomUUID());
        testTransaction.setAmount(BigDecimal.valueOf(100));

        testTransactionResponse = new TransactionResponse();
        testTransactionResponse.setId(1L);
        testTransactionResponse.setReferenceNumber(testTransaction.getReferenceNumber());
        testTransactionResponse.setAmount(BigDecimal.valueOf(100));
    }

    @Test
    void findById_shouldReturnTransactionResponse() {
        when(transactionRepository.findById(1L)).thenReturn(Optional.of(testTransaction));
        when(transactionResponseMapper.toTransactionResponse(testTransaction)).thenReturn(testTransactionResponse);

        var result = transactionService.findById(1L);

        assertNotNull(result);
        assertEquals(testTransactionResponse, result);

        verify(transactionRepository).findById(1L);
        verify(transactionResponseMapper).toTransactionResponse(testTransaction);
    }

    @Test
    void findById_shouldThrowExceptionWhenTransactionNotFound() {
        when(transactionRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementFoundException.class, () -> transactionService.findById(1L));

        verify(transactionRepository).findById(1L);
    }

    @Test
    void findByReferenceNumber_shouldReturnTransactionResponse() {
        var referenceNumber = testTransaction.getReferenceNumber();

        when(transactionRepository.findByReferenceNumber(referenceNumber)).thenReturn(Optional.of(testTransaction));
        when(transactionResponseMapper.toTransactionResponse(testTransaction)).thenReturn(testTransactionResponse);

        var result = transactionService.findByReferenceNumber(referenceNumber);

        assertNotNull(result);
        assertEquals(testTransactionResponse, result);

        verify(transactionRepository).findByReferenceNumber(referenceNumber);
        verify(transactionResponseMapper).toTransactionResponse(testTransaction);
    }

    @Test
    void findByReferenceNumber_shouldThrowExceptionWhenTransactionNotFound() {
        var referenceNumber = UUID.randomUUID();

        when(transactionRepository.findByReferenceNumber(referenceNumber)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementFoundException.class, () -> transactionService.findByReferenceNumber(referenceNumber));

        verify(transactionRepository).findByReferenceNumber(referenceNumber);
    }

    @Test
    void findAllByUserId_readsOnePageFromTheDatabase() {
        var userId = 1L;
        var pageable = org.springframework.data.domain.PageRequest.of(0, 2);
        var from = java.time.Instant.parse("2026-01-01T03:00:00Z");
        when(transactionRepository.findPageByUserId(userId, from, pageable))
                .thenReturn(new PageImpl<>(List.of(testTransaction, testTransaction), pageable, 5));
        when(transactionResponseMapper.toTransactionResponse(any(Transaction.class))).thenReturn(testTransactionResponse);

        var result = transactionService.findAllByUserId(userId, from, pageable);

        assertEquals(2, result.getNumberOfElements());
        assertEquals(5, result.getTotalElements());
        assertEquals(3, result.getTotalPages());
        verify(transactionRepository).findPageByUserId(userId, from, pageable);
    }

    @Test
    void findAllByUserId_marksBothSidesOfAMoveBetweenOwnAccounts() {
        var pageable = org.springframework.data.domain.PageRequest.of(0, 10);
        Wallet checking = new Wallet();
        checking.setId(1L);
        Wallet savings = new Wallet();
        savings.setId(2L);
        Transaction out = imported(10L, "Withdrawal", checking, "500.00");
        Transaction in = imported(11L, "Deposit", savings, "500.00");
        Transaction rent = imported(12L, "Withdrawal", checking, "1500.00");
        when(transactionRepository.findPageByUserId(1L, null, pageable))
                .thenReturn(new PageImpl<>(List.of(out, in, rent), pageable, 3));
        when(transactionResponseMapper.toTransactionResponse(any(Transaction.class)))
                .thenAnswer(call -> new TransactionResponse());

        var result = transactionService.findAllByUserId(1L, null, pageable).getContent();

        assertTrue(result.get(0).isOwnAccountMove());
        assertTrue(result.get(1).isOwnAccountMove());
        assertFalse(result.get(2).isOwnAccountMove(), "a payment with no matching deposit is an expense");
    }

    private static Transaction imported(long id, String typeName, Wallet wallet, String amount) {
        var type = new com.github.yildizmy.domain.entity.Type();
        type.setName(typeName);
        Transaction transaction = new Transaction();
        transaction.setId(id);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setCreatedAt(java.time.Instant.parse("2026-11-20T15:00:00Z"));
        transaction.setSource(com.github.yildizmy.domain.enums.TransactionSource.OPEN_FINANCE);
        transaction.setPaymentType("PIX");
        transaction.setFromWallet(wallet);
        transaction.setToWallet(wallet);
        transaction.setType(type);
        return transaction;
    }

    @Test
    void findAll_shouldReturnPageOfTransactionResponses() {
        var pageable = Pageable.unpaged();
        var transactionPage = new PageImpl<>(List.of(testTransaction));

        when(transactionRepository.findAll(pageable)).thenReturn(transactionPage);
        when(transactionResponseMapper.toTransactionResponse(testTransaction)).thenReturn(testTransactionResponse);

        var result = transactionService.findAll(pageable);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertEquals(testTransactionResponse, result.getContent().get(0));

        verify(transactionRepository).findAll(pageable);
        verify(transactionResponseMapper).toTransactionResponse(testTransaction);
    }

    @Test
    void findAll_shouldThrowExceptionWhenNoTransactionsFound() {
        var pageable = Pageable.unpaged();

        when(transactionRepository.findAll(pageable)).thenReturn(Page.empty());

        assertThrows(NoSuchElementFoundException.class, () -> transactionService.findAll(pageable));

        verify(transactionRepository).findAll(pageable);
    }

    @Test
    void create_shouldCreateNewTransaction() {
        var request = new TransactionRequest();
        request.setAmount(BigDecimal.valueOf(100));

        var fromWallet = new Wallet();
        fromWallet.setIban("FROM123");

        var toWallet = new Wallet();
        toWallet.setIban("TO123");

        testTransaction.setFromWallet(fromWallet);
        testTransaction.setToWallet(toWallet);

        when(transactionRequestMapper.toTransaction(request)).thenReturn(testTransaction);
        when(transactionRepository.save(testTransaction)).thenReturn(testTransaction);

        var result = transactionService.create(request);

        assertNotNull(result);
        assertEquals(1L, result.id());

        verify(transactionRequestMapper).toTransaction(request);
        verify(transactionRepository).save(testTransaction);
    }
    @Test
    void repeatedRequestReturnsOriginalResultAndRejectsChangedAmount() {
        var request = new TransactionRequest();
        var key = java.util.UUID.randomUUID();
        request.setRequestId(key); request.setFromWalletIban("FROM"); request.setToWalletIban("TO");
        request.setTypeId(1L); request.setAmount(new BigDecimal("10.00"));
        var transaction = new Transaction(); transaction.setId(42L); transaction.setAmount(new BigDecimal("10.00"));
        var from = new Wallet(); from.setIban("FROM");
        var to = new Wallet(); to.setIban("TO");
        var type = new com.github.yildizmy.domain.entity.Type(); type.setId(1L);
        transaction.setFromWallet(from); transaction.setToWallet(to); transaction.setType(type);
        when(transactionRepository.findByRequestId(key)).thenReturn(java.util.Optional.of(transaction));
        assertEquals(42L, transactionService.replay(request).id());
        request.setAmount(new BigDecimal("20.00"));
        assertThrows(com.github.yildizmy.exception.WalletRuleException.class, () -> transactionService.replay(request));
        verify(transactionRepository, never()).save(any());
    }

}
