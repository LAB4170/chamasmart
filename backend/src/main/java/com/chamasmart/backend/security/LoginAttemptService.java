package com.chamasmart.backend.security;

import org.springframework.stereotype.Service;

/** Locks a sign-in after repeated failures for the same address and account. */
@Service
public class LoginAttemptService {
    static final int MAX_FAILURES = 5;
    static final long WINDOW_MS = 15 * 60 * 1000L;

    private final RateLimiter failures;

    public LoginAttemptService() { this(new RateLimiter()); }

    LoginAttemptService(RateLimiter limiter) { this.failures = limiter; }

    private static String key(String ip, String email) { return ip + "|" + (email == null ? "" : email.toLowerCase()); }

    public boolean isBlocked(String ip, String email) {
        return failures.count(key(ip, email), WINDOW_MS) >= MAX_FAILURES;
    }

    public void recordFailure(String ip, String email) { failures.hit(key(ip, email), WINDOW_MS); }

    public void reset(String ip, String email) { failures.clear(key(ip, email)); }

    public long retryAfterMinutes(String ip, String email) {
        return Math.max(1, (failures.retryAfterSeconds(key(ip, email), WINDOW_MS) + 59) / 60);
    }
}
