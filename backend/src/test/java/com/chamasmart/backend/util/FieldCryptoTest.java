package com.chamasmart.backend.util;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class FieldCryptoTest {
    @AfterEach void reset() { FieldCrypto.configure(null); }

    private static String key() { return Base64.getEncoder().encodeToString(new byte[32]); }

    @Test void encryptsAndDecryptsWithAKey() {
        assertTrue(FieldCrypto.configure(key()));
        String stored = FieldCrypto.encrypt("12345678");
        assertTrue(stored.startsWith("e1:"));
        assertFalse(stored.contains("12345678"));
        assertEquals("12345678", FieldCrypto.decrypt(stored));
        assertTrue(stored.length() <= 255);
    }

    @Test void sameValueEncryptsDifferentlyEachTime() {
        FieldCrypto.configure(key());
        assertNotEquals(FieldCrypto.encrypt("12345678"), FieldCrypto.encrypt("12345678"));
    }

    @Test void withoutAKeyTheValueIsMarkedNotEncrypted() {
        assertFalse(FieldCrypto.configure(""));
        assertEquals("p1:12345678", FieldCrypto.encrypt("12345678"));
        assertEquals("12345678", FieldCrypto.decrypt("p1:12345678"));
    }

    @Test void legacyPlainValuesStillRead() {
        assertEquals("12345678", FieldCrypto.decrypt("12345678"));
        assertNull(FieldCrypto.decrypt(null));
    }

    @Test void anEncryptedValueCannotBeReadWithoutTheKey() {
        FieldCrypto.configure(key());
        String stored = FieldCrypto.encrypt("12345678");
        FieldCrypto.configure(null);
        assertThrows(IllegalStateException.class, () -> FieldCrypto.decrypt(stored));
    }

    @Test void aTamperedValueIsRejected() {
        FieldCrypto.configure(key());
        String stored = FieldCrypto.encrypt("12345678");
        String tampered = stored.substring(0, stored.length() - 3) + (stored.endsWith("AAA") ? "BBB" : "AAA");
        assertThrows(IllegalStateException.class, () -> FieldCrypto.decrypt(tampered));
    }

    @Test void wrongKeyIsRejected() {
        FieldCrypto.configure(key());
        String stored = FieldCrypto.encrypt("12345678");
        byte[] other = new byte[32]; other[0] = 1;
        FieldCrypto.configure(Base64.getEncoder().encodeToString(other));
        assertThrows(IllegalStateException.class, () -> FieldCrypto.decrypt(stored));
    }
}
