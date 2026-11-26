package com.github.yildizmy.service;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.dto.mapper.TransactionRequestMapper;
import com.github.yildizmy.dto.mapper.TransactionResponseMapper;
import com.github.yildizmy.dto.request.TransactionRequest;
import com.github.yildizmy.dto.response.CommandResponse;
import com.github.yildizmy.dto.response.TransactionResponse;
import com.github.yildizmy.exception.NoSuchElementFoundException;
import com.github.yildizmy.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static com.github.yildizmy.common.MessageKeys.*;

/**
 * Service used for Transaction related operations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionService {

    private final MessageSourceConfig messageConfig;
    private final TransactionRepository transactionRepository;
    private final TransactionRequestMapper transactionRequestMapper;
    private final TransactionResponseMapper transactionResponseMapper;

    /**
     * Fetches a single transaction by the given id.
     *
     * @param id
     * @return TransactionResponse
     */
    @Transactional(readOnly = true)
    public TransactionResponse findById(long id) {
        return transactionRepository.findById(id)
                .map(transactionResponseMapper::toTransactionResponse)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_TRANSACTION_NOT_FOUND)));
    }

    /**
     * Fetches a single transaction by the given referenceNumber.
     *
     * @param referenceNumber
     * @return TransactionResponse
     */
    @Transactional(readOnly = true)
    public TransactionResponse findByReferenceNumber(UUID referenceNumber) {
        return transactionRepository.findByReferenceNumber(referenceNumber)
                .map(transactionResponseMapper::toTransactionResponse)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_TRANSACTION_NOT_FOUND)));
    }

    /**
     * Fetches all transaction by the given userId.
     *
     * @param userId
     * @return List of TransactionResponse
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> findAllByUserId(Long userId, java.time.Instant from, Pageable pageable) {
        Page<Transaction> page = transactionRepository.findPageByUserId(userId, from, pageable);
        // ponytail: pairs are looked for inside the page; a pair split by a page break shows as two ordinary
        // moves. Upgrade: query the neighbouring day when the page edge cuts one.
        java.util.Set<Transaction> ownMoves = InsightsService.ownAccountPairs(page.getContent());
        return page.map(transaction -> {
            TransactionResponse response = transactionResponseMapper.toTransactionResponse(transaction);
            response.setOwnAccountMove(ownMoves.contains(transaction));
            return response;
        });
    }

    /**
     * Fetches all transactions based on the given paging and sorting parameters.
     *
     * @param pageable
     * @return List of TransactionResponse
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> findAll(Pageable pageable) {
        final Page<Transaction> transactions = transactionRepository.findAll(pageable);
        if (transactions.isEmpty())
            throw new NoSuchElementFoundException(messageConfig.getMessage(ERROR_NO_RECORDS));

        return transactions.map(transactionResponseMapper::toTransactionResponse);
    }

    /**
     * Creates a new transaction using the given request parameters.
     *
     * @param request
     * @return id of the created transaction
     */
    public CommandResponse replay(TransactionRequest request) {
        if (request.getRequestId() == null) return null;
        return transactionRepository.findByRequestId(request.getRequestId()).map(existing -> {
            if (existing.getAmount().compareTo(request.getAmount()) != 0 ||
                !existing.getFromWallet().getIban().equals(request.getFromWalletIban()) ||
                !existing.getToWallet().getIban().equals(request.getToWalletIban()) ||
                !existing.getType().getId().equals(request.getTypeId()) ||
                !java.util.Objects.equals(existing.getDescription(), request.getDescription())) {
                throw new com.github.yildizmy.exception.WalletRuleException("IDEMPOTENCY_CONFLICT");
            }
            return CommandResponse.builder().id(existing.getId()).build();
        }).orElse(null);
    }

    public boolean hasHistory(long walletId) {
        return transactionRepository.existsByFromWalletIdOrToWalletId(walletId, walletId);
    }

    public CommandResponse create(TransactionRequest request) {
        final Transaction transaction = transactionRequestMapper.toTransaction(request);
        transactionRepository.save(transaction);
        log.info(messageConfig.getMessage(INFO_TRANSACTION_CREATED, transaction.getFromWallet().getIban(), transaction.getToWallet().getIban(), transaction.getAmount()));
        return CommandResponse.builder().id(transaction.getId()).build();
    }
}
