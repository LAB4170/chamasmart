package com.chamasmart.backend.mfa;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TotpTest {
    // RFC 6238 appendix B: the secret is the ASCII string 12345678901234567890; 6-digit codes are the last six digits.
    private static final String RFC_SECRET = Totp.base32("12345678901234567890".getBytes());

    @Test
    void matchesTheRfcTestVectors() {
        assertEquals("287082", Totp.codeFor(RFC_SECRET, Totp.stepAt(59)));
        assertEquals("081804", Totp.codeFor(RFC_SECRET, Totp.stepAt(1111111109L)));
        assertEquals("050471", Totp.codeFor(RFC_SECRET, Totp.stepAt(1111111111L)));
        assertEquals("005924", Totp.codeFor(RFC_SECRET, Totp.stepAt(1234567890L)));
        assertEquals("279037", Totp.codeFor(RFC_SECRET, Totp.stepAt(2000000000L)));
    }

    @Test
    void acceptsOneStepOfClockDriftButNotMore() {
        long now = 1_700_000_000L;
        String current = Totp.codeFor(RFC_SECRET, Totp.stepAt(now));
        String previous = Totp.codeFor(RFC_SECRET, Totp.stepAt(now) - 1);
        String twoBack = Totp.codeFor(RFC_SECRET, Totp.stepAt(now) - 2);
        assertEquals(Totp.stepAt(now), Totp.match(RFC_SECRET, current, now));
        assertEquals(Totp.stepAt(now) - 1, Totp.match(RFC_SECRET, previous, now));
        assertEquals(-1, Totp.match(RFC_SECRET, twoBack, now));
    }

    @Test
    void rejectsMalformedCodes() {
        assertEquals(-1, Totp.match(RFC_SECRET, null, 1_700_000_000L));
        assertEquals(-1, Totp.match(RFC_SECRET, "12345", 1_700_000_000L));
        assertEquals(-1, Totp.match(RFC_SECRET, "abcdef", 1_700_000_000L));
    }

    @Test
    void base32RoundTrips() {
        String secret = Totp.newSecret();
        assertEquals(32, secret.length());
        assertEquals(secret, Totp.base32(Totp.decodeBase32(secret)));
    }

    @Test
    void uriCarriesIssuerAndSecret() {
        String uri = Totp.otpauthUri("ChamaSmart", "a@b.co", "ABCDEF234567");
        assertTrue(uri.startsWith("otpauth://totp/ChamaSmart%3Aa%40b.co?secret=ABCDEF234567"));
        assertTrue(uri.contains("issuer=ChamaSmart"));
    }
}
