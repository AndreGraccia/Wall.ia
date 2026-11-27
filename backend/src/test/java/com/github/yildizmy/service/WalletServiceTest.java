package com.github.yildizmy.service;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.dto.mapper.WalletRequestMapper;
import com.github.yildizmy.dto.mapper.WalletResponseMapper;
import com.github.yildizmy.dto.mapper.WalletTransactionRequestMapper;
import com.github.yildizmy.dto.request.TransactionRequest;
import com.github.yildizmy.dto.request.WalletRequest;
import com.github.yildizmy.dto.response.CommandResponse;
import com.github.yildizmy.dto.response.WalletResponse;
import com.github.yildizmy.exception.ElementAlreadyExistsException;
import com.github.yildizmy.exception.InsufficientFundsException;
import com.github.yildizmy.exception.NoSuchElementFoundException;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.validator.IbanValidator;
import com.github.yildizmy.domain.entity.User;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.security.WalletAccess;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Spy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @InjectMocks
    private WalletService walletService;

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private TransactionService transactionService;

    @Mock
    private WalletRequestMapper walletRequestMapper;

    @Mock
    private WalletResponseMapper walletResponseMapper;

    @Mock
    private WalletTransactionRequestMapper walletTransactionRequestMapper;

    @Mock
    private IbanValidator ibanValidator;

    @Mock
    private MessageSourceConfig messageConfig;

    // Real ownership logic; it only reads the security context, the repositories are never touched.
    @Spy
    private WalletAccess walletAccess = new WalletAccess(null, null);

    private static final long OWNER_ID = 7L;

    @BeforeEach
    void authenticateOwner() {
        var owner = new UserDetailsImpl(OWNER_ID, "owner", "x", "A", "B", java.util.List.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(owner, null, owner.getAuthorities()));
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void findById_shouldReturnWalletResponse() {
        var wallet = createTestWallet(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000));
        var expectedResponse = createTestWalletResponse(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000));

        when(walletRepository.findById(1L)).thenReturn(Optional.of(wallet));
        when(walletResponseMapper.toWalletResponse(wallet)).thenReturn(expectedResponse);

        var result = walletService.findById(1L);

        assertNotNull(result);
        assertEquals(expectedResponse, result);
        verify(walletRepository).findById(1L);
        verify(walletResponseMapper).toWalletResponse(wallet);
    }

    @Test
    void findById_shouldThrowExceptionWhenWalletNotFound() {
        when(walletRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementFoundException.class, () -> walletService.findById(1L));
        verify(walletRepository).findById(1L);
    }

    @Test
    void findByIban_shouldReturnWalletResponse() {
        var wallet = createTestWallet(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000));
        var expectedResponse = createTestWalletResponse(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000));

        when(walletRepository.findByIban("TEST123")).thenReturn(Optional.of(wallet));
        when(walletResponseMapper.toWalletResponse(wallet)).thenReturn(expectedResponse);

        var result = walletService.findByIban("TEST123");

        assertNotNull(result);
        assertEquals(expectedResponse, result);
        verify(walletRepository).findByIban("TEST123");
        verify(walletResponseMapper).toWalletResponse(wallet);
    }

    @Test
    void findByUserId_shouldReturnListOfWalletResponses() {
        var wallets = Arrays.asList(
                createTestWallet(1L, "TEST123", "Test Wallet 1", BigDecimal.valueOf(1000)),
                createTestWallet(2L, "TEST456", "Test Wallet 2", BigDecimal.valueOf(2000))
        );
        var expectedResponses = Arrays.asList(
                createTestWalletResponse(1L, "TEST123", "Test Wallet 1", BigDecimal.valueOf(1000)),
                createTestWalletResponse(2L, "TEST456", "Test Wallet 2", BigDecimal.valueOf(2000))
        );

        when(walletRepository.findByUserId(1L)).thenReturn(wallets);
        when(walletResponseMapper.toWalletResponse(any(Wallet.class)))
                .thenReturn(expectedResponses.get(0), expectedResponses.get(1));

        var result = walletService.findByUserId(1L);

        assertNotNull(result);
        assertEquals(2, result.size());
        assertEquals(expectedResponses, result);
        verify(walletRepository).findByUserId(1L);
        verify(walletResponseMapper, times(2)).toWalletResponse(any(Wallet.class));
    }

    @Test
    void getByIban_shouldReturnWallet() {
        var expectedWallet = createTestWallet(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000));

        when(walletRepository.findByIban("TEST123")).thenReturn(Optional.of(expectedWallet));

        var result = walletService.getByIban("TEST123");

        assertNotNull(result);
        assertEquals(expectedWallet, result);
        verify(walletRepository).findByIban("TEST123");
    }

    @Test
    void getByIban_shouldThrowExceptionWhenWalletNotFound() {
        when(walletRepository.findByIban("TEST123")).thenReturn(Optional.empty());

        assertThrows(NoSuchElementFoundException.class, () -> walletService.getByIban("TEST123"));
        verify(walletRepository).findByIban("TEST123");
    }

    @Test
    void findAll_shouldReturnPageOfWalletResponses() {
        var walletPage = new PageImpl<>(Collections.singletonList(
                createTestWallet(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000))
        ));
        var pageable = Pageable.unpaged();
        var expectedResponse = createTestWalletResponse(1L, "TEST123", "Test Wallet", BigDecimal.valueOf(1000));

        when(walletRepository.findAll(pageable)).thenReturn(walletPage);
        when(walletResponseMapper.toWalletResponse(any(Wallet.class))).thenReturn(expectedResponse);

        var result = walletService.findAll(pageable);

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertEquals(expectedResponse, result.getContent().get(0));
        verify(walletRepository).findAll(pageable);
        verify(walletResponseMapper).toWalletResponse(any(Wallet.class));
    }

    @Test
    void findAll_shouldThrowExceptionWhenNoWalletsFound() {
        var pageable = Pageable.unpaged();
        when(walletRepository.findAll(pageable)).thenReturn(Page.empty());

        assertThrows(NoSuchElementFoundException.class, () -> walletService.findAll(pageable));
        verify(walletRepository).findAll(pageable);
    }

    @Test
    void create_shouldCreateNewWallet() {
        var request = createTestWalletRequest(
        1L,
        "TEST123",
        "Test Wallet",
        BigDecimal.ZERO
);

    var wallet = createTestWallet(
        1L,
        "TEST123",
        "Test Wallet",
        BigDecimal.ZERO
);

        when(ibanValidator.isValid(anyString(), isNull())).thenReturn(true);
        when(walletRepository.existsByIbanIgnoreCase(anyString())).thenReturn(false);
        when(walletRepository.existsByUserIdAndNameIgnoreCase(anyLong(), anyString())).thenReturn(false);
        when(walletRequestMapper.toWallet(request)).thenReturn(wallet);
        when(walletRepository.save(wallet)).thenReturn(wallet);

        var result = walletService.create(request);

        assertNotNull(result);
        assertEquals(1L, result.id());
        verify(walletRepository).existsByIbanIgnoreCase(request.getIban());
        verify(walletRepository).existsByUserIdAndNameIgnoreCase(request.getUserId(), request.getName());
        verify(ibanValidator).isValid(request.getIban(), null);
        verify(walletRequestMapper).toWallet(request);
        verify(walletRepository).save(wallet);
        verify(transactionService, never()).create(any(TransactionRequest.class));
    }

    @Test
    void create_shouldThrowExceptionWhenIbanAlreadyExists() {
        var request = createTestWalletRequest(
            1L,
            "TEST123",
            "Test Wallet",
            BigDecimal.ZERO
        );

        when(ibanValidator.isValid(anyString(), isNull())).thenReturn(true);
        when(walletRepository.existsByIbanIgnoreCase(anyString())).thenReturn(true);

        assertThrows(ElementAlreadyExistsException.class, () -> walletService.create(request));
        verify(walletRepository).existsByIbanIgnoreCase(request.getIban());
    }

    @Test
    void transferFunds_shouldTransferFundsBetweenWallets() {
        var fromWallet = createTestWallet(1L, "FROM123", "From Wallet", BigDecimal.valueOf(1000));
        var toWallet = createTestWallet(2L, "TO123", "To Wallet", BigDecimal.valueOf(500));
        var request = createTestTransactionRequest("FROM123", "TO123", BigDecimal.valueOf(200));

        when(walletRepository.lockByIbans(anyList())).thenReturn(java.util.List.of(fromWallet, toWallet));
        when(transactionService.create(request)).thenReturn(new CommandResponse(1L));

        var result = walletService.transferFunds(request);

        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals(BigDecimal.valueOf(800), fromWallet.getBalance());
        assertEquals(BigDecimal.valueOf(700), toWallet.getBalance());
        verify(walletRepository).save(toWallet);
        verify(transactionService).create(request);
    }

    @Test
    void transferFunds_shouldThrowExceptionWhenInsufficientFunds() {
        var fromWallet = createTestWallet(1L, "FROM123", "From Wallet", BigDecimal.valueOf(100));
        var toWallet = createTestWallet(2L, "TO123", "To Wallet", BigDecimal.valueOf(500));
        var request = createTestTransactionRequest("FROM123", "TO123", BigDecimal.valueOf(200));

        when(walletRepository.lockByIbans(anyList())).thenReturn(java.util.List.of(fromWallet, toWallet));

        assertThrows(InsufficientFundsException.class, () -> walletService.transferFunds(request));
    }

    @Test
    void withdrawFunds_shouldWithdrawFundsFromWallet() {
        var fromWallet = createTestWallet(1L, "FROM123", "From Wallet", BigDecimal.valueOf(1000));
        var request = createTestTransactionRequest("FROM123", null, BigDecimal.valueOf(200));

        when(walletRepository.lockByIbans(anyList())).thenReturn(java.util.List.of(fromWallet));
        when(transactionService.create(request)).thenReturn(new CommandResponse(1L));

        var result = walletService.withdrawFunds(request);

        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals(BigDecimal.valueOf(800), fromWallet.getBalance());
        verify(walletRepository).save(fromWallet);
        verify(transactionService).create(request);
    }

    @Test
    void transferAndWithdraw_refuseWalletOfAnotherUserEvenWithoutControllerCheck() {
        var foreign = createTestWallet(1L, "FROM123", "Someone else's", BigDecimal.valueOf(1000));
        foreign.getUser().setId(99L);
        var mine = createTestWallet(2L, "TO123", "Mine", BigDecimal.ZERO);
        when(walletRepository.lockByIbans(anyList())).thenReturn(java.util.List.of(foreign, mine));

        assertThrows(AccessDeniedException.class,
                () -> walletService.transferFunds(createTestTransactionRequest("FROM123", "TO123", BigDecimal.TEN)));
        assertThrows(AccessDeniedException.class,
                () -> walletService.withdrawFunds(createTestTransactionRequest("FROM123", null, BigDecimal.TEN)));

        assertEquals(BigDecimal.valueOf(1000), foreign.getBalance());
        assertEquals(BigDecimal.ZERO, mine.getBalance());
        verify(walletRepository, never()).save(any());
        verifyNoInteractions(transactionService);
    }

    @Test
    void transfer_refusesWhenNobodyIsAuthenticated() {
        SecurityContextHolder.clearContext();
        var from = createTestWallet(1L, "FROM123", "From", BigDecimal.valueOf(1000));
        var to = createTestWallet(2L, "TO123", "To", BigDecimal.ZERO);
        when(walletRepository.lockByIbans(anyList())).thenReturn(java.util.List.of(from, to));

        assertThrows(AccessDeniedException.class,
                () -> walletService.transferFunds(createTestTransactionRequest("FROM123", "TO123", BigDecimal.TEN)));
        verifyNoInteractions(transactionService);
    }

    @Test
    void operations_rejectInvalidAmountsBeforeTouchingBalances() {
        for (var amount : java.util.List.of(new BigDecimal("-1"), BigDecimal.ZERO, new BigDecimal("0.001"), new BigDecimal("10000000000"))) {
            var request = createTestTransactionRequest("FROM", "TO", amount);
            assertThrows(com.github.yildizmy.exception.WalletRuleException.class, () -> walletService.transferFunds(request));
            assertThrows(com.github.yildizmy.exception.WalletRuleException.class, () -> walletService.withdrawFunds(request));
        }
        verifyNoInteractions(walletRepository, transactionService);
    }

    @Test
    void transfer_rejectsSameWallet() {
        var request = createTestTransactionRequest("SAME", "SAME", BigDecimal.ONE);
        assertThrows(com.github.yildizmy.exception.WalletRuleException.class, () -> walletService.transferFunds(request));
        verifyNoInteractions(walletRepository, transactionService);
    }

    @Test
    void withdrawal_cannotOverdraw() {
        var wallet = createTestWallet(1L, "FROM", "Wallet", BigDecimal.TEN);
        var request = createTestTransactionRequest("FROM", "FROM", new BigDecimal("10.01"));
        when(walletRepository.lockByIbans(anyList())).thenReturn(java.util.List.of(wallet));
        assertThrows(InsufficientFundsException.class, () -> walletService.withdrawFunds(request));
        assertEquals(BigDecimal.TEN, wallet.getBalance());
        verify(transactionService, never()).create(any());
    }

    @Test
    void create_shouldRejectNonZeroInitialBalance() {

        var request = new WalletRequest();

        request.setUserId(1L);
        request.setName("Principal");
        request.setIban("BR123456789012345678901234567");
        request.setBalance(new BigDecimal("100.00"));

            assertThrows(
                    com.github.yildizmy.exception.WalletRuleException.class,
                    () -> walletService.create(request)
            );

        verify(walletRepository, never()).save(any());
        verify(transactionService, never()).create(any());
        }

        @Test
        void create_shouldAllowWalletWithZeroBalance() {

        var request = new WalletRequest();

        request.setUserId(1L);
        request.setName("Principal");
        request.setIban("BR123456789012345678901234567");
        request.setBalance(BigDecimal.ZERO);

        var wallet = new Wallet();

        wallet.setId(10L);
        wallet.setName("Principal");
        wallet.setIban(request.getIban());
        wallet.setBalance(BigDecimal.ZERO);

        when(ibanValidator.isValid(request.getIban(), null))
                .thenReturn(true);

        when(walletRepository.existsByIbanIgnoreCase(request.getIban()))
                .thenReturn(false);

        when(
            walletRepository.existsByUserIdAndNameIgnoreCase(
                1L,
                "Principal"
            )
        ).thenReturn(false);

        when(walletRequestMapper.toWallet(request))
                .thenReturn(wallet);

        when(walletRepository.save(wallet))
                .thenReturn(wallet);

        var result = walletService.create(request);

        assertNotNull(result);
        assertEquals(10L, result.id());

        assertEquals(
                0,
                wallet.getBalance().compareTo(BigDecimal.ZERO)
        );

        verify(walletRepository).save(wallet);

        verify(
                transactionService,
                never()
        ).create(any());
    }

    // Helper Methods
    private Wallet createTestWallet(Long id, String iban, String name, BigDecimal balance) {
        var wallet = new Wallet();
        wallet.setId(id);
        wallet.setIban(iban);
        wallet.setName(name);
        wallet.setBalance(balance);
        var owner = new User();
        owner.setId(OWNER_ID);
        wallet.setUser(owner);
        return wallet;
    }

    private WalletResponse createTestWalletResponse(Long id, String iban, String name, BigDecimal balance) {
        var response = new WalletResponse();
        response.setId(id);
        response.setIban(iban);
        response.setName(name);
        response.setBalance(balance);
        return response;
    }

    private WalletRequest createTestWalletRequest(Long userId, String iban, String name, BigDecimal balance) {
        var request = new WalletRequest();
        request.setUserId(userId);
        request.setIban(iban);
        request.setName(name);
        request.setBalance(balance);
        return request;
    }

    private TransactionRequest createTestTransactionRequest(String fromWalletIban, String toWalletIban, BigDecimal amount) {
        var request = new TransactionRequest();
        request.setFromWalletIban(fromWalletIban);
        request.setToWalletIban(toWalletIban);
        request.setAmount(amount);
        return request;
    }
}
