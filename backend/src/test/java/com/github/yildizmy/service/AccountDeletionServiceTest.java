package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.User;
import com.github.yildizmy.exception.CodedException;
import com.github.yildizmy.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AccountDeletionServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-25T15:00:00Z");
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final UserRepository users = mock(UserRepository.class);
    private final OpenFinanceImportService openFinance = mock(OpenFinanceImportService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AccountDeletionService service =
            new AccountDeletionService(users, encoder, openFinance, jdbc, Clock.fixed(NOW, ZoneOffset.UTC));

    private User ana() {
        User user = new User();
        user.setId(7L);
        user.setUsername("ana2026");
        user.setEmail("ana@example.test");
        user.setFirstName("Ana");
        user.setLastName("Souza");
        user.setPassword(encoder.encode("Teste@12345"));
        user.setEmailVerifiedAt(NOW.minusSeconds(3600));
        when(users.findById(7L)).thenReturn(Optional.of(user));
        return user;
    }

    @Test
    void aWrongPasswordDeletesNothing() {
        ana();
        CodedException error = assertThrows(CodedException.class, () -> service.delete(7L, "errada12345"));
        assertEquals("INVALID_PASSWORD", error.getCode());
        verifyNoInteractions(openFinance, jdbc);
        verify(users, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void theRightPasswordErasesWhatIsOnlyTheirsAndAnonymisesTheRest() {
        User user = ana();
        String oldHash = user.getPassword();

        service.delete(7L, "Teste@12345");

        verify(openFinance).purge(7L);
        AccountDeletionService.OWN_ROWS.forEach(sql -> verify(jdbc).update(sql, 7L));
        verify(jdbc).update(eq("UPDATE wallet SET name = ? WHERE user_id = ?"), eq(AccountDeletionService.CLOSED_WALLET_NAME), eq(7L));
        assertEquals("excluido#7", user.getUsername());
        assertEquals("excluido#7", user.getEmail());
        assertFalse(user.getFirstName().contains("Ana") || user.getLastName().contains("Souza"));
        assertNull(user.getEmailVerifiedAt(), "login is refused from now on");
        assertEquals(NOW, user.getTokensValidAfter(), "every token already issued stops working");
        assertFalse(encoder.matches("Teste@12345", user.getPassword()));
        assertTrue(!oldHash.equals(user.getPassword()));
        verify(users).save(user);
    }

    @Test
    void walletsWithHistoryAreNeverDeletedBecauseTheyAreAlsoTheCounterpartysStatement() {
        assertTrue(AccountDeletionService.OWN_ROWS.stream()
                .filter(sql -> sql.startsWith("DELETE FROM wallet"))
                .allMatch(sql -> sql.contains("NOT EXISTS") && sql.contains("from_wallet_id") && sql.contains("to_wallet_id")));
        assertFalse(AccountDeletionService.OWN_ROWS.stream().anyMatch(sql -> sql.startsWith("DELETE FROM transaction")));
        assertFalse(AccountDeletionService.OWN_ROWS.stream().anyMatch(sql -> sql.contains("\"user\"")));
    }

    /**
     * The user row is pseudonymised, never deleted, so ON DELETE CASCADE from "user" never fires. Every table with a
     * user_id has to be cleaned explicitly; this reads the migrations so a new table cannot be forgotten
     * (charge_alert_decision, V33, was).
     */
    @Test
    void everyTableWithAUserIdIsCleanedOnDeletion() throws java.io.IOException {
        // credit_card and loan go through OpenFinanceImportService.purge; wallet is pseudonymised when it has history.
        var handledElsewhere = java.util.Set.of("credit_card", "loan");
        var renamed = java.util.Map.of("open_finance_email_challenge", "email_verification_challenge");
        var createTable = java.util.regex.Pattern.compile(
                "CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?(?:public\\.)?\"?(\\w+)\"?\\s*\\((.*?)\\n\\);",
                java.util.regex.Pattern.CASE_INSENSITIVE | java.util.regex.Pattern.DOTALL);
        var tables = new java.util.TreeSet<String>();
        try (var files = java.nio.file.Files.list(java.nio.file.Path.of("src/main/resources/db/migration"))) {
            for (var file : files.toList()) {
                var matcher = createTable.matcher(java.nio.file.Files.readString(file));
                while (matcher.find()) {
                    if (matcher.group(2).matches("(?s).*\\buser_id\\b.*")) {
                        tables.add(renamed.getOrDefault(matcher.group(1), matcher.group(1)));
                    }
                }
            }
        }
        assertTrue(tables.contains("charge_alert_decision"), "the migration scan must actually find the tables");
        for (String table : tables) {
            if (handledElsewhere.contains(table)) continue;
            assertTrue(AccountDeletionService.OWN_ROWS.stream().anyMatch(sql -> sql.startsWith("DELETE FROM " + table + " ")),
                    table + " has a user_id and is not cleaned when the account is deleted");
        }
    }

    @Test
    void theAnonymisedNameAndEmailCanNeverBeTakenBySomeoneSigningUpFirst() {
        // Otherwise registering "excluido-<id>" in advance made the victim's deletion fail on the unique index.
        var request = new com.github.yildizmy.dto.request.SignupRequest();
        request.setFirstName("Ataque");
        request.setLastName("Teste");
        request.setUsername("excluido#7");
        request.setEmail("excluido#7");
        request.setPassword("Senha-forte-123");
        try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var fields = factory.getValidator().validate(request).stream()
                    .map(violation -> violation.getPropertyPath().toString()).collect(java.util.stream.Collectors.toSet());
            assertTrue(fields.containsAll(java.util.Set.of("username", "email")), fields.toString());
        }
    }
}
