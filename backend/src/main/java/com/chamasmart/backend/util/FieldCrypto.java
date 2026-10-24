package com.chamasmart.backend.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM for the few fields that are genuinely sensitive (national ID). The key comes from DATA_ENCRYPTION_KEY, a
 * base64 string of 32 random bytes kept outside the database. Without a key the value is stored with a "p1:" marker and
 * a warning is logged, so a missing setting never blocks a deploy; set the key and the value is encrypted the next time
 * it is saved (or at startup by the migration).
 *
 * Stored forms: "e1:" + base64(iv + ciphertext), "p1:" + plaintext, or a bare legacy value (plaintext).
 */
public final class FieldCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static volatile SecretKeySpec key;

    private FieldCrypto() {}

    /** Called once at startup. Returns true when a usable key was installed. */
    public static boolean configure(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) { key = null; return false; }
        byte[] raw = Base64.getDecoder().decode(base64Key.trim());
        if (raw.length != 32) throw new IllegalStateException("DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
        key = new SecretKeySpec(raw, "AES");
        return true;
    }

    public static boolean hasKey() { return key != null; }

    public static String encrypt(String plain) {
        if (plain == null) return null;
        if (plain.startsWith("e1:") || plain.startsWith("p1:")) return plain; // already in stored form
        SecretKeySpec k = key;
        if (k == null) return "p1:" + plain;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return "e1:" + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Could not encrypt a protected field", e);
        }
    }

    public static String decrypt(String stored) {
        if (stored == null) return null;
        if (stored.startsWith("p1:")) return stored.substring(3);
        if (!stored.startsWith("e1:")) return stored; // legacy plaintext
        SecretKeySpec k = key;
        if (k == null) throw new IllegalStateException("A protected field is encrypted but DATA_ENCRYPTION_KEY is not set");
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(3));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Could not decrypt a protected field (wrong DATA_ENCRYPTION_KEY?)", e);
        }
    }
}
