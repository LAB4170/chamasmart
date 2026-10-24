package com.chamasmart.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtSecretTest {
    private JwtUtil util(String secret, String... profiles) {
        JwtUtil u = new JwtUtil();
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profiles);
        ReflectionTestUtils.setField(u, "environment", env);
        ReflectionTestUtils.setField(u, "jwtSecret", secret);
        ReflectionTestUtils.setField(u, "jwtExpirationMs", 1000L);
        return u;
    }

    @Test
    void productionRefusesToStartWithAMissingOrPlaceholderSecret() {
        assertThrows(IllegalStateException.class, () -> ReflectionTestUtils.invokeMethod(util("", "prod"), "checkSecret"));
        assertThrows(IllegalStateException.class, () -> ReflectionTestUtils.invokeMethod(util("your_jwt_secret_placeholder_replace_in_render_environment", "prod"), "checkSecret"));
        assertThrows(IllegalStateException.class, () -> ReflectionTestUtils.invokeMethod(util("short", "prod"), "checkSecret"));
    }

    @Test
    void productionAcceptsAStrongSecret() {
        String strong = "0123456789abcdef0123456789abcdef0123";
        assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(util(strong, "prod"), "checkSecret"));
    }

    @Test
    void developmentGetsAnEphemeralRandomSecretSoNothingWeakIsShared() {
        JwtUtil dev = util("", "dev");
        ReflectionTestUtils.invokeMethod(dev, "checkSecret");
        String s = (String) ReflectionTestUtils.getField(dev, "jwtSecret");
        assertTrue(s.length() >= 32);
    }
}
