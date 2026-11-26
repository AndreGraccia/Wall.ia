package com.github.yildizmy.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Encryption at rest for free text that names people and companies (ADR 0014): AES-256-GCM, a random 96-bit IV
 * per value, stored as {@code enc:v2:<key id>:<base64(iv | ciphertext | tag)>}. Values without a prefix were written
 * before the key existed and are read as they are.
 * <p>
 * Rotation (ADR 0016): {@code data_encryption_key} writes; {@code data_encryption_previous_keys} (comma-separated)
 * only read. The key id is the start of the key's SHA-256, so nothing else has to be configured. {@code enc:v1:}
 * values, written before key ids, are tried with every key; GCM's tag makes a wrong key fail, never return text.
 * {@code EncryptionRotationService} rewrites old values under the current key, after which a previous key can go.
 * <p>
 * Without a key, text is stored as is and a warning is logged; the production compose file refuses to start without
 * it. Static holder because Hibernate creates attribute converters itself.
 */
@Slf4j
@Component
public final class FieldCipher {

    public static final String PREFIX = "enc:";
    static final String PREFIX_V1 = "enc:v1:";
    private static final String PREFIX_V2 = "enc:v2:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private record Keys(String currentId, SecretKeySpec current, Map<String, SecretKeySpec> all) {
    }

    private static volatile Keys keys;

    public FieldCipher(@Value("${app.security.dataEncryptionKey:}") String base64Key,
                       @Value("${app.security.dataEncryptionPreviousKeys:}") String previousKeys) {
        use(base64Key, previousKeys);
    }

    static void use(String base64Key) {
        use(base64Key, "");
    }

    /** Fails at startup on a malformed key; a blank current key only turns encryption off, with a warning. */
    static void use(String base64Key, String previousKeys) {
        if (base64Key == null || base64Key.isBlank()) {
            keys = null;
            log.warn("data_encryption_key is not set: imported descriptions are stored without encryption");
            return;
        }
        SecretKeySpec current = parse(base64Key, "data_encryption_key");
        Map<String, SecretKeySpec> all = new LinkedHashMap<>();
        all.put(id(current), current);
        if (previousKeys != null) {
            for (String previous : previousKeys.split(",")) {
                if (previous.isBlank()) continue;
                SecretKeySpec key = parse(previous, "data_encryption_previous_keys");
                all.putIfAbsent(id(key), key);
            }
        }
        keys = new Keys(id(current), current, Map.copyOf(all));
    }

    private static SecretKeySpec parse(String base64Key, String name) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(name + " must be Base64", exception);
        }
        if (bytes.length != 32) throw new IllegalStateException(name + " must have 32 bytes (256 bits)");
        return new SecretKeySpec(bytes, "AES");
    }

    /** First 8 hex digits of the key's SHA-256: identifies the key without revealing it. */
    private static String id(SecretKeySpec key) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(key.getEncoded())).substring(0, 8);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static String encrypt(String plain) {
        Keys current = keys;
        if (plain == null || current == null) return plain;
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, current.current(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX_V2 + current.currentId() + ":" + Base64.getEncoder()
                    .encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("could not encrypt a field", exception);
        }
    }

    public static String decrypt(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) return stored;
        Keys current = keys;
        if (current == null) throw new IllegalStateException("encrypted data found but data_encryption_key is not set");
        if (stored.startsWith(PREFIX_V2)) {
            int separator = stored.indexOf(':', PREFIX_V2.length());
            SecretKeySpec key = separator < 0 ? null : current.all().get(stored.substring(PREFIX_V2.length(), separator));
            if (key == null) throw new IllegalStateException("encrypted with a key that is not configured");
            return open(key, stored.substring(separator + 1));
        }
        if (stored.startsWith(PREFIX_V1)) {
            for (SecretKeySpec key : current.all().values()) {
                try {
                    return open(key, stored.substring(PREFIX_V1.length()));
                } catch (IllegalStateException wrongKey) {
                    // try the next one
                }
            }
        }
        // Tampered, truncated, written with another key or an unknown version: never garbage as if it were text.
        throw new IllegalStateException("could not decrypt a field");
    }

    /** True when the value is already encrypted under the current key; false for clear text and older keys. */
    public static boolean isCurrent(String stored) {
        Keys current = keys;
        return current != null && stored != null && stored.startsWith(PREFIX_V2 + current.currentId() + ":");
    }

    /** Whether a key is configured at all; without one there is nothing to rotate. */
    public static boolean enabled() {
        return keys != null;
    }

    /** The SQL LIKE pattern of values under the current key, for the rotation job's query. */
    public static String currentPattern() {
        return PREFIX_V2 + keys.currentId() + ":%";
    }

    private static String open(SecretKeySpec key, String payload) {
        try {
            byte[] all = Base64.getDecoder().decode(payload);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("could not decrypt a field", exception);
        }
    }
}
