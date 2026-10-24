package com.chamasmart.backend.security;

import jakarta.servlet.http.HttpServletRequest;

/** Best-effort client address behind Render and Cloudflare. */
public final class ClientIp {
    private ClientIp() {}

    /** Address of the request being served, for audit rows. Falls back to "internal" outside a request (jobs, tests). */
    public static String current() {
        var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
            String ip = of(sra.getRequest());
            return ip == null || ip.length() > 45 ? "internal" : ip;
        }
        return "internal";
    }

    public static String currentUserAgent() {
        var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
            String ua = sra.getRequest().getHeader("User-Agent");
            if (ua != null && !ua.isBlank()) return ua.length() > 300 ? ua.substring(0, 300) : ua;
        }
        return "System-Service";
    }

    public static String of(HttpServletRequest request) {
        String cf = request.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) return cf.trim();
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
