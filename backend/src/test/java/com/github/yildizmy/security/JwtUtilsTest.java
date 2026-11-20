package com.github.yildizmy.security;

import com.github.yildizmy.config.MessageSourceConfig;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/** Only tokens this API signed, for this client, inside their lifetime, are accepted. */
class JwtUtilsTest {

    // 256-bit test-only keys (Base64), never used outside this class.
    private static final String SECRET = "dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtMDE=";
    private static final String OTHER_SECRET = "b3V0cmEtY2hhdmUtb3V0cmEtY2hhdmUtb3V0cmEtY2hhdmUtMDI=";

    private static JwtUtils jwtUtils(String secret, long expirationMs) {
        JwtUtils utils = new JwtUtils(mock(MessageSourceConfig.class));
        ReflectionTestUtils.setField(utils, "jwtSecret", secret);
        ReflectionTestUtils.setField(utils, "jwtExpirationMs", expirationMs);
        return utils;
    }

    private static String tokenFor(JwtUtils utils, String username) {
        UserDetailsImpl user = new UserDetailsImpl(7L, username, "x", "A", "B",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return utils.generateJwtToken(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private static SecretKey key(String secret) {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }

    @Test
    void aTokenItIssuedIsValidAndNamesTheUser() {
        JwtUtils utils = jwtUtils(SECRET, 60_000);
        String token = tokenFor(utils, "ana@exemplo.com");

        assertTrue(utils.validateJwtToken(token));
        assertEquals("ana@exemplo.com", utils.getUsernameFromJwtToken(token));
    }

    @Test
    void anExpiredTokenIsRejected() {
        JwtUtils utils = jwtUtils(SECRET, -1_000);

        assertFalse(utils.validateJwtToken(tokenFor(utils, "ana@exemplo.com")));
    }

    @Test
    void aTokenSignedWithAnotherKeyIsRejected() {
        String foreign = tokenFor(jwtUtils(OTHER_SECRET, 60_000), "ana@exemplo.com");

        assertFalse(jwtUtils(SECRET, 60_000).validateJwtToken(foreign));
    }

    @Test
    void aTokenFromAnotherIssuerIsRejectedEvenWithTheRightKey() {
        String token = Jwts.builder().subject("ana@exemplo.com").issuer("other-api")
                .audience().add(JwtUtils.AUDIENCE).and()
                .expiration(new Date(System.currentTimeMillis() + 60_000)).signWith(key(SECRET)).compact();

        assertFalse(jwtUtils(SECRET, 60_000).validateJwtToken(token));
    }

    @Test
    void aTokenForAnotherAudienceIsRejectedEvenWithTheRightKey() {
        String token = Jwts.builder().subject("ana@exemplo.com").issuer(JwtUtils.ISSUER)
                .audience().add("other-client").and()
                .expiration(new Date(System.currentTimeMillis() + 60_000)).signWith(key(SECRET)).compact();

        assertFalse(jwtUtils(SECRET, 60_000).validateJwtToken(token));
    }

    @Test
    void aTokenWithoutIssuerOrAudienceIsRejected() {
        String token = Jwts.builder().subject("ana@exemplo.com")
                .expiration(new Date(System.currentTimeMillis() + 60_000)).signWith(key(SECRET)).compact();

        assertFalse(jwtUtils(SECRET, 60_000).validateJwtToken(token));
    }

    @Test
    void anUnsignedTokenIsRejected() {
        String token = Jwts.builder().subject("ana@exemplo.com").issuer(JwtUtils.ISSUER)
                .audience().add(JwtUtils.AUDIENCE).and().compact();

        assertFalse(jwtUtils(SECRET, 60_000).validateJwtToken(token));
    }

    @Test
    void garbageAndEmptyTokensAreRejectedWithoutThrowing() {
        JwtUtils utils = jwtUtils(SECRET, 60_000);

        assertFalse(utils.validateJwtToken("not.a.jwt"));
        assertFalse(utils.validateJwtToken(""));
    }

    @Test
    void aSecretShorterThan256BitsFailsAtStartup() {
        JwtUtils utils = jwtUtils("c2hvcnQ=", 60_000); // "short"

        assertThrows(IllegalStateException.class, utils::validateSecret);
    }

    @Test
    void aSecretThatIsNotBase64FailsAtStartup() {
        assertThrows(IllegalStateException.class, jwtUtils("não é base64!", 60_000)::validateSecret);
    }

    @Test
    void logoutEverywhereRevokesTokensIssuedBeforeItAndKeepsLaterOnes() {
        JwtUtils utils = jwtUtils(SECRET, 60_000);
        String token = tokenFor(utils, "ana@exemplo.com");
        Instant issuedAt = utils.getIssuedAt(token);
        UserDetailsImpl user = new UserDetailsImpl(7L, "ana@exemplo.com", "x", "A", "B", List.of());

        user.setTokensValidAfter(issuedAt.plusSeconds(1));
        assertTrue(AuthTokenFilter.revoked(user, utils.getIssuedAt(token)));

        // iat has second precision: a logout in the same second as the login keeps that login.
        user.setTokensValidAfter(issuedAt.plusMillis(999));
        assertFalse(AuthTokenFilter.revoked(user, utils.getIssuedAt(token)));
    }
}
