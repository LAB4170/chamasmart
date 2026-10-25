package com.chamasmart.backend.mfa;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/** RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 second steps), the format every authenticator app uses. */
public final class Totp {
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();
    public static final int STEP_SECONDS = 30;

    private Totp() {}

    public static String newSecret() {
        byte[] raw = new byte[20];
        RANDOM.nextBytes(raw);
        return base32(raw);
    }

    public static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0, bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bits += 8;
            while (bits >= 5) {
                out.append(ALPHABET.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) out.append(ALPHABET.charAt((buffer << (5 - bits)) & 31));
        return out.toString();
    }

    public static byte[] decodeBase32(String text) {
        String clean = text.replace(" ", "").replace("=", "").toUpperCase();
        ByteBuffer out = ByteBuffer.allocate(clean.length() * 5 / 8 + 1);
        int buffer = 0, bits = 0;
        for (char ch : clean.toCharArray()) {
            int v = ALPHABET.indexOf(ch);
            if (v < 0) throw new IllegalArgumentException("Not a valid secret");
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) ((buffer >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }
        byte[] result = new byte[out.position()];
        out.flip();
        out.get(result);
        return result;
    }

    public static long stepAt(long epochSeconds) { return epochSeconds / STEP_SECONDS; }

    public static String codeFor(String secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(decodeBase32(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24) | ((hash[offset + 1] & 0xFF) << 16) | ((hash[offset + 2] & 0xFF) << 8) | (hash[offset + 3] & 0xFF);
            return String.format("%06d", binary % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Returns the step the code matched (within one step either side for clock drift), or -1. The caller must refuse any
     * step at or below the last one used, so a code that was seen once cannot be replayed.
     */
    public static long match(String secret, String code, long nowEpochSeconds) {
        if (code == null || !code.matches("\\d{6}")) return -1;
        long now = stepAt(nowEpochSeconds);
        for (long step = now - 1; step <= now + 1; step++) {
            if (java.security.MessageDigest.isEqual(codeFor(secret, step).getBytes(), code.getBytes())) return step;
        }
        return -1;
    }

    public static String otpauthUri(String issuer, String account, String secret) {
        String label = java.net.URLEncoder.encode(issuer + ":" + account, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
        return "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + java.net.URLEncoder.encode(issuer, java.nio.charset.StandardCharsets.UTF_8) + "&algorithm=SHA1&digits=6&period=30";
    }
}
