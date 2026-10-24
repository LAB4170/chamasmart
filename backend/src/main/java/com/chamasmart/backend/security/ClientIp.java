package com.chamasmart.backend.security;

import jakarta.servlet.http.HttpServletRequest;

/** Best-effort client address behind Render and Cloudflare. */
public final class ClientIp {
    private ClientIp() {}

    public static String of(HttpServletRequest request) {
        String cf = request.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) return cf.trim();
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
