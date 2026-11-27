package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.User;
import com.github.yildizmy.exception.CodedException;
import com.github.yildizmy.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.List;

/**
 * "Excluir minha conta" (LGPD art. 18, VI), ADR 0012.
 * <p>
 * What is only the person's is deleted: Open Finance data and consent, answers, goals, envelopes, alerts,
 * snapshots, push subscriptions, codes and roles. The user row itself stays, anonymised, because a transfer
 * points at both wallets: deleting it would erase the other person's statement (LGPD art. 16 allows keeping
 * it for that). Local wallets without history go; wallets with history stay under a neutral name.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    static final String CLOSED_WALLET_NAME = "Conta encerrada";

    /** Rows that belong to the person alone. Order matters only for readability; none references another. */
    static final List<String> OWN_ROWS = List.of(
            "DELETE FROM recurrence_decision WHERE user_id = ?",
            "DELETE FROM charge_alert_decision WHERE user_id = ?",
            "DELETE FROM goal WHERE user_id = ?",
            "DELETE FROM future_alert WHERE user_id = ?",
            "DELETE FROM envelope WHERE user_id = ?",
            "DELETE FROM manual_debt WHERE user_id = ?",
            "DELETE FROM investment WHERE user_id = ?", // its values go with it (ON DELETE CASCADE)
            "DELETE FROM life_goal WHERE user_id = ?", // its steps go with it (ON DELETE CASCADE)
            "DELETE FROM month_plan WHERE user_id = ?", // its slices go with it (ON DELETE CASCADE)
            "DELETE FROM financial_profile WHERE user_id = ?",
            "DELETE FROM method_choice WHERE user_id = ?",
            "DELETE FROM forecast_snapshot WHERE user_id = ?",
            "DELETE FROM push_subscription WHERE user_id = ?",
            "DELETE FROM email_verification_challenge WHERE user_id = ?",
            "DELETE FROM open_finance_connection WHERE user_id = ?",
            "DELETE FROM open_finance_consent WHERE user_id = ?", // permissions and events go with it (ON DELETE CASCADE)
            "DELETE FROM user_role WHERE user_id = ?",
            "DELETE FROM wallet w WHERE w.user_id = ? AND NOT EXISTS "
                    + "(SELECT 1 FROM transaction t WHERE t.from_wallet_id = w.id OR t.to_wallet_id = w.id)");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OpenFinanceImportService openFinanceImport;
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public void delete(long userId, String password) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CodedException("INVALID_PASSWORD", HttpStatus.FORBIDDEN));
        // The token alone is not enough: a stolen session must not be able to erase the account.
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new CodedException("INVALID_PASSWORD", HttpStatus.FORBIDDEN);
        }

        openFinanceImport.purge(userId);
        OWN_ROWS.forEach(sql -> jdbc.update(sql, userId));
        jdbc.update("UPDATE wallet SET name = ? WHERE user_id = ?", CLOSED_WALLET_NAME, userId);

        // "#" is outside the sign-up username pattern and there is no "@": nobody can register these first and make
        // the deletion fail on the unique indexes (security review of 25/09).
        String tag = "excluido#" + userId;
        user.setUsername(tag);
        user.setEmail(tag);
        user.setFirstName("Conta");
        user.setLastName("excluida");
        user.setPassword(passwordEncoder.encode(randomSecret()));
        user.setEmailVerifiedAt(null);
        user.setTokensValidAfter(clock.instant());
        userRepository.save(user);
        log.info("Account {} deleted and anonymised", userId);
    }

    private String randomSecret() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }
}
