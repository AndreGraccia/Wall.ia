package com.github.yildizmy.security;

import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import java.util.UUID;

@org.springframework.transaction.annotation.Transactional(readOnly = true)
@Component("walletAccess")
@RequiredArgsConstructor
public class WalletAccess {
    private final WalletRepository wallets;
    private final TransactionRepository transactions;
    private Long currentUserId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl user ? user.getId() : null;
    }
    public boolean user(Long id) { return id != null && id.equals(currentUserId()); }
    public boolean wallet(Long id) { var user = currentUserId(); return user != null && wallets.existsByIdAndUserId(id, user); }
    /** Same check as iban(), on a wallet already loaded (and locked) by the caller: no second query. */
    public boolean owns(com.github.yildizmy.domain.entity.Wallet wallet) { return wallet.getUser() != null && user(wallet.getUser().getId()); }
    public boolean iban(String iban) { var user = currentUserId(); return user != null && wallets.existsByIbanAndUserId(iban, user); }
    public boolean transaction(Long id) { return transactions.findById(id).map(t -> user(t.getFromWallet().getUser().getId()) || user(t.getToWallet().getUser().getId())).orElse(false); }
    public boolean reference(UUID reference) { return transactions.findByReferenceNumber(reference).map(t -> user(t.getFromWallet().getUser().getId()) || user(t.getToWallet().getUser().getId())).orElse(false); }
}
