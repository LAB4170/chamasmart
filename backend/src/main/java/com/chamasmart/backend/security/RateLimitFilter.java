package com.chamasmart.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Per-address limits on the endpoints an attacker would hammer: sign-in, sign-up and the AI chat. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {
    record Rule(int limit, long windowMs) {}

    private static final Map<String, Rule> RULES = Map.of(
            "/auth/login", new Rule(30, 15 * 60_000L),
            "/auth/register", new Rule(10, 60 * 60_000L),
            "/auth/firebase-sync", new Rule(30, 15 * 60_000L),
            "/chat/ai-support", new Rule(30, 10 * 60_000L));

    private final RateLimiter limiter;

    public RateLimitFilter() { this(new RateLimiter()); }

    RateLimitFilter(RateLimiter limiter) { this.limiter = limiter; }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        Rule rule = "POST".equalsIgnoreCase(request.getMethod()) ? RULES.get(request.getServletPath()) : null;
        if (rule != null) {
            String key = request.getServletPath() + "|" + ClientIp.of(request);
            if (!limiter.allow(key, rule.limit(), rule.windowMs())) {
                long retry = limiter.retryAfterSeconds(key, rule.windowMs());
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retry));
                response.setContentType("application/json");
                response.getOutputStream().write(("{\"success\":false,\"message\":\"Too many requests. Please wait a few minutes and try again.\",\"data\":null}")
                        .getBytes(StandardCharsets.UTF_8));
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
