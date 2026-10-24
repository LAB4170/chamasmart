package com.chamasmart.backend.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class LegacyBase64MigrationTest {
    private static String enc(String s) { return Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8)); }

    @Test void valuesTheOldConverterWroteAreDecoded() {
        assertEquals("PENDING", LegacyBase64Migration.decodeLegacy(enc("PENDING")));
        assertEquals("a@b.com", LegacyBase64Migration.decodeLegacy(enc("a@b.com")));
        assertEquals("Wanjiru Njoroge-Kamau", LegacyBase64Migration.decodeLegacy(enc("Wanjiru Njoroge-Kamau")));
        assertEquals("Café ñ", LegacyBase64Migration.decodeLegacy(enc("Café ñ")));
        assertEquals("line1\nline2", LegacyBase64Migration.decodeLegacy(enc("line1\nline2")));
    }

    @Test void plainValuesAreLeftAlone() {
        assertNull(LegacyBase64Migration.decodeLegacy("MEMBER"));          // not valid Base64 length
        assertNull(LegacyBase64Migration.decodeLegacy("hello world"));      // not Base64 alphabet
        assertNull(LegacyBase64Migration.decodeLegacy("APPROVED"));         // valid Base64 text, but decodes to bytes that are not text
        assertNull(LegacyBase64Migration.decodeLegacy(""));
        assertNull(LegacyBase64Migration.decodeLegacy(null));
    }

    @Test void decodingIsStableAcrossAWholeRoundTrip() {
        for (String s : new String[]{"x", "ab", "abc", "abcd", "+254 700 000 000", "https://res.cloudinary.com/x/y.png", "{\"k\":1}"}) {
            assertEquals(s, LegacyBase64Migration.decodeLegacy(enc(s)));
        }
    }
}
