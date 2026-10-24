package com.chamasmart.backend.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SafeUrlTest {
    @Test void acceptsPlainHttps() { assertEquals("https://zoom.us/j/123", SafeUrl.https("  https://zoom.us/j/123 ", "meeting")); }
    @Test void blankIsNull() { assertNull(SafeUrl.https("  ", "x")); assertNull(SafeUrl.https(null, "x")); }
    @Test void refusesScriptAndDataLinks() {
        assertThrows(IllegalArgumentException.class, () -> SafeUrl.https("javascript:alert(1)", "x"));
        assertThrows(IllegalArgumentException.class, () -> SafeUrl.https("data:text/html;base64,AAA", "x"));
    }
    @Test void refusesPlainHttp() { assertThrows(IllegalArgumentException.class, () -> SafeUrl.https("http://example.com", "x")); }
    @Test void refusesInternalHosts() {
        for (String u : new String[]{"https://localhost/a", "https://127.0.0.1/a", "https://192.168.1.5/a", "https://10.0.0.2/a", "https://169.254.169.254/a", "https://intranet/a"})
            assertThrows(IllegalArgumentException.class, () -> SafeUrl.https(u, "x"), u);
    }
    @Test void refusesCredentialsInTheLink() { assertThrows(IllegalArgumentException.class, () -> SafeUrl.https("https://user:pw@example.com/", "x")); }
    @Test void refusesVeryLongLinks() { assertThrows(IllegalArgumentException.class, () -> SafeUrl.https("https://example.com/" + "a".repeat(600), "x")); }
}
