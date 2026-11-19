package com.github.yildizmy.service;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.dto.mapper.WalletRequestMapper;
import com.github.yildizmy.dto.mapper.WalletResponseMapper;
import com.github.yildizmy.dto.request.TransactionRequest;
import com.github.yildizmy.dto.request.WalletRequest;
import com.github.yildizmy.dto.response.CommandResponse;
import com.github.yildizmy.dto.response.WalletResponse;
import com.github.yildizmy.exception.ElementAlreadyExistsException;
import com.github.yildizmy.exception.InsufficientFundsException;
import com.github.yildizmy.exception.NoSuchElementFoundException;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.security.WalletAccess;
import org.springframework.security.access.AccessDeniedException;
import com.github.yildizmy.validator.IbanValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.math.BigDecimal;
import com.github.yildizmy.exception.WalletRuleException;

import static com.github.yildizmy.common.MessageKeys.*;

/**
 * Service used for Wallet related operations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final MessageSourceConfig messageConfig;
    private final WalletRepository walletRepository;
    private final TransactionService transactionService;
    private final WalletRequestMapper walletRequestMapper;
    private final WalletResponseMapper walletResponseMapper;
    private final IbanValidator ibanValidator;
    private final WalletAccess walletAccess;

    /**
     * Fetches a single wallet by the given id.
     *
     * @param id
     * @return WalletResponse
     */
    @Transactional(readOnly = true)
    public WalletResponse findById(long id) {
        return walletRepository.findById(id)
                .map(walletResponseMapper::toWalletResponse)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_WALLET_NOT_FOUND)));
    }

    /**
     * Fetches a single wallet by the given iban.
     *
     * @param iban
     * @return WalletResponse
     */
    @Transactional(readOnly = true)
    public WalletResponse findByIban(String iban) {
        return walletRepository.findByIban(iban)
                .map(walletResponseMapper::toWalletResponse)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_WALLET_NOT_FOUND)));
    }

    /**
     * Fetches a single wallet by the given userId.
     *
     * @param userId
     * @return WalletResponse
     */
    @Transactional(readOnly = true)
    public List<WalletResponse> findByUserId(long userId) {
        return walletRepository.findByUserId(userId).stream()
                .map(walletResponseMapper::toWalletResponse)
                .toList();
    }

    /**
     * Fetches a single wallet reference (entity) by the given id.
     *
     * @param iban
     * @return Wallet
     */
    public Wallet getByIban(String iban) {
        return walletRepository.findByIban(iban)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_WALLET_NOT_FOUND)));
    }

    /**
     * Fetches all wallets based on the given paging and sorting parameters.
     *
     * @param pageable
     * @return List of WalletResponse
     */
    @Transactional(readOnly = true)
    public Page<WalletResponse> findAll(Pageable pageable) {
        final Page<Wallet> wallets = walletRepository.findAll(pageable);
        if (wallets.isEmpty())
            throw new NoSuchElementFoundException(messageConfig.getMessage(ERROR_NO_RECORDS));
        return wallets.map(walletResponseMapper::toWalletResponse);
    }

    /**
     * Creates a new wallet using the given request parameters.
     *
     * @param request
     * @return id of the created wallet
     */
    @Transactional
    public CommandResponse create(WalletRequest request) {

        if (request.getBalance() == null ||
                request.getBalance().compareTo(BigDecimal.ZERO) != 0) {
            throw new WalletRuleException("INITIAL_BALANCE_NOT_ALLOWED");
        }

        request.setBalance(BigDecimal.ZERO);
        request.setName(request.getName().trim());
        if (request.getIban() == null || request.getIban().isBlank()) {
            String digits = String.format("%025d", new java.math.BigInteger(java.util.UUID.randomUUID().toString().replace("-", ""), 16).mod(java.math.BigInteger.TEN.pow(25)));
            int checksum = 98 - new java.math.BigInteger(digits + "112700").mod(java.math.BigInteger.valueOf(97)).intValue();
            request.setIban("BR" + String.format("%02d", checksum) + digits);
        }
        request.setIban(request.getIban().replaceAll("\\s", "").toUpperCase(java.util.Locale.ROOT));
        if (!ibanValidator.isValid(request.getIban(), null)) throw new WalletRuleException("INVALID_WALLET");
        if (walletRepository.existsByIbanIgnoreCase(request.getIban()))
            throw new ElementAlreadyExistsException(messageConfig.getMessage(ERROR_WALLET_IBAN_EXISTS));
        if (walletRepository.existsByUserIdAndNameIgnoreCase(request.getUserId(), request.getName()))
            throw new ElementAlreadyExistsException(messageConfig.getMessage(ERROR_WALLET_NAME_EXISTS));


        final Wallet wallet = walletRequestMapper.toWallet(request);

        walletRepository.save(wallet);

        log.info(
                messageConfig.getMessage(
                        INFO_WALLET_CREATED,
                        wallet.getIban(),
                        wallet.getName(),
                        wallet.getBalance()
                )
        );

        return CommandResponse.builder()
                .id(wallet.getId())
                .build();
        }

    /**
     * Transfer funds between wallets.
     *
     * @param request
     * @return id of the transaction
     */
    private void validateAmount(BigDecimal amount, boolean allowZero) {
        if (amount == null || amount.signum() < 0 || (!allowZero && amount.signum() == 0) ||
            amount.stripTrailingZeros().scale() > 2 || amount.compareTo(new BigDecimal("9999999999.99")) > 0) {
            throw new WalletRuleException("INVALID_AMOUNT");
        }
    }

    private Wallet lockedWallet(String iban, List<Wallet> wallets) {
        return wallets.stream().filter(w -> w.getIban().equals(iban)).findFirst()
            .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_WALLET_NOT_FOUND)));
    }

    @Transactional
    public CommandResponse transferFunds(TransactionRequest request) {
        validateAmount(request.getAmount(), false);
        if (request.getFromWalletIban().equals(request.getToWalletIban())) throw new WalletRuleException("SAME_WALLET");
        request.setTypeId(1L);
        var locked = walletRepository.lockByIbans(List.of(request.getFromWalletIban(), request.getToWalletIban()));
        var from = lockedWallet(request.getFromWalletIban(), locked);
        var to = lockedWallet(request.getToWalletIban(), locked);
        assertOwned(from);
        assertLocal(from);
        assertLocal(to);
        var replay = transactionService.replay(request);
        if (replay != null) return replay;
        if (from.getBalance().compareTo(request.getAmount()) < 0)
            throw new InsufficientFundsException(messageConfig.getMessage(ERROR_INSUFFICIENT_FUNDS));
        validateAmount(to.getBalance().add(request.getAmount()), true);
        from.setBalance(from.getBalance().subtract(request.getAmount()));
        to.setBalance(to.getBalance().add(request.getAmount()));
        walletRepository.save(from);
        walletRepository.save(to);
        return transactionService.create(request);
    }

    @Transactional
    public CommandResponse withdrawFunds(TransactionRequest request) {
        validateAmount(request.getAmount(), false);
        request.setToWalletIban(request.getFromWalletIban());
        request.setTypeId(5L);
        var wallet = lockedWallet(request.getFromWalletIban(), walletRepository.lockByIbans(List.of(request.getFromWalletIban())));
        assertOwned(wallet);
        assertLocal(wallet);
        var replay = transactionService.replay(request);
        if (replay != null) return replay;
        if (wallet.getBalance().compareTo(request.getAmount()) < 0)
            throw new InsufficientFundsException(messageConfig.getMessage(ERROR_INSUFFICIENT_FUNDS));
        wallet.setBalance(wallet.getBalance().subtract(request.getAmount()));
        walletRepository.save(wallet);
        return transactionService.create(request);
    }

    /**
     * Updates wallet using the given request parameters.
     *
     * @param request
     * @return id of the updated wallet
     */
    @Transactional
    public CommandResponse update(long id, WalletRequest request) {
        final Wallet foundWallet = walletRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_WALLET_NOT_FOUND)));

        assertLocal(foundWallet);

        if (!java.util.Objects.equals(request.getIban(), foundWallet.getIban()) ||
            !java.util.Objects.equals(request.getUserId(), foundWallet.getUser().getId()) ||
            request.getBalance().compareTo(foundWallet.getBalance()) != 0) throw new WalletRuleException("IMMUTABLE_WALLET");
        String name = request.getName().trim();
        if (!name.equalsIgnoreCase(foundWallet.getName()) && walletRepository.existsByUserIdAndNameIgnoreCase(request.getUserId(), name))
            throw new ElementAlreadyExistsException(messageConfig.getMessage(ERROR_WALLET_NAME_EXISTS));
        final Wallet wallet = foundWallet;
        wallet.setName(name);
        walletRepository.save(wallet);
        log.info(messageConfig.getMessage(INFO_WALLET_UPDATED, wallet.getIban(), wallet.getName(), wallet.getBalance()));
        return CommandResponse.builder().id(id).build();
    }

    /**
     * Deletes wallet by the given id.
     *
     * @param id
     */
    @Transactional
    public void deleteById(long id) {
        final Wallet wallet = walletRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementFoundException(messageConfig.getMessage(ERROR_WALLET_NOT_FOUND)));
        assertLocal(wallet);
        if (wallet.getBalance().signum() != 0 || transactionService.hasHistory(id)) throw new WalletRuleException("IMMUTABLE_WALLET");
        walletRepository.delete(wallet);
        log.info(messageConfig.getMessage(INFO_WALLET_DELETED, wallet.getIban(), wallet.getName(), wallet.getBalance()));
    }

    /**
     * Defence in depth: the controller already checks @walletAccess.iban, but money only leaves a wallet whose owner is
     * the authenticated user, whoever calls this method. Same 403 as the controller check.
     */
    private void assertOwned(Wallet wallet) {
        if (!walletAccess.owns(wallet)) throw new AccessDeniedException("FORBIDDEN");
    }

    private void assertLocal(Wallet wallet) {
        if (wallet.getSource() == WalletSource.OPEN_FINANCE) {
            throw new WalletRuleException("OPEN_FINANCE_READ_ONLY");
        }
    }
}
