package com.chamasmart.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class RateLimitingTest {

    @Test
    void limiterAllowsUpToTheLimitThenBlocksUntilTheWindowPasses() {
        AtomicLong now = new AtomicLong(1_000);
        RateLimiter limiter = new RateLimiter(now::get);
        for (int i = 0; i < 3; i++) assertTrue(limiter.allow("k", 3, 60_000));
        assertFalse(limiter.allow("k", 3, 60_000));
        assertTrue(limiter.retryAfterSeconds("k", 60_000) > 0);
        now.addAndGet(60_001);
        assertTrue(limiter.allow("k", 3, 60_000));
    }

    @Test
    void limiterKeepsKeysSeparate() {
        RateLimiter limiter = new RateLimiter();
        assertTrue(limiter.allow("a", 1, 60_000));
        assertFalse(limiter.allow("a", 1, 60_000));
        assertTrue(limiter.allow("b", 1, 60_000));
    }

    @Test
    void loginIsLockedAfterFiveFailuresForTheSameAddressAndAccountOnly() {
        LoginAttemptService attempts = new LoginAttemptService();
        for (int i = 0; i < 5; i++) {
            assertFalse(attempts.isBlocked("1.1.1.1", "A@x.com"));
            attempts.recordFailure("1.1.1.1", "A@x.com");
        }
        assertTrue(attempts.isBlocked("1.1.1.1", "a@x.com"), "email case must not matter");
        assertFalse(attempts.isBlocked("2.2.2.2", "a@x.com"), "another address is not locked out");
        assertFalse(attempts.isBlocked("1.1.1.1", "b@x.com"), "another account is not locked");
        attempts.reset("1.1.1.1", "a@x.com");
        assertFalse(attempts.isBlocked("1.1.1.1", "a@x.com"));
    }

    @Test
    void filterReturns429WithRetryAfterOnceTheLoginLimitIsUsed() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiter());
        int blockedAt = -1;
        for (int i = 1; i <= 31; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            req.setServletPath("/auth/login");
            req.addHeader("CF-Connecting-IP", "9.9.9.9");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            if (res.getStatus() == 429) {
                blockedAt = i;
                assertNotNull(res.getHeader("Retry-After"));
                assertTrue(res.getContentAsString().contains("Too many requests"));
                break;
            }
        }
        assertEquals(31, blockedAt);
    }

    @Test
    void filterIgnoresOtherPathsAndMethods() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimiter());
        for (int i = 0; i < 100; i++) {
            MockHttpServletRequest get = new MockHttpServletRequest("GET", "/api/v1/auth/login");
            get.setServletPath("/auth/login");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(get, res, new MockFilterChain());
            assertNotEquals(429, res.getStatus());
        }
    }

    @Test
    void clientIpPrefersTheCloudflareHeaderThenForwardedFor() {
        MockHttpServletRequest r = new MockHttpServletRequest();
        r.setRemoteAddr("10.0.0.5");
        assertEquals("10.0.0.5", ClientIp.of(r));
        r.addHeader("X-Forwarded-For", "5.5.5.5, 10.0.0.1");
        assertEquals("5.5.5.5", ClientIp.of(r));
        r.addHeader("CF-Connecting-IP", "7.7.7.7");
        assertEquals("7.7.7.7", ClientIp.of(r));
    }
}
