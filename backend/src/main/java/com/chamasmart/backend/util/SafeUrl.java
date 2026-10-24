package com.chamasmart.backend.util;

import java.net.URI;
import java.util.Locale;

/** Only plain https links to public hosts are accepted wherever a person can paste a link that others will click. */
public final class SafeUrl {
    private SafeUrl() {}

    /** Returns the trimmed link, or null when blank. Throws when the link could be used to attack whoever opens it. */
    public static String https(String raw, String what) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();
        if (s.length() > 500) throw new IllegalArgumentException("The " + what + " link is too long");
        URI u;
        try {
            u = new URI(s);
        } catch (java.net.URISyntaxException e) {
            throw new IllegalArgumentException("The " + what + " link is not a valid web address");
        }
        if (u.getScheme() == null || !u.getScheme().equalsIgnoreCase("https"))
            throw new IllegalArgumentException("The " + what + " link must start with https://");
        String host = u.getHost();
        if (host == null || host.isBlank() || u.getUserInfo() != null)
            throw new IllegalArgumentException("The " + what + " link is not a valid web address");
        String h = host.toLowerCase(Locale.ROOT);
        boolean internal = h.equals("localhost") || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")
                || h.matches("^(127|10)\\..*") || h.matches("^192\\.168\\..*") || h.matches("^172\\.(1[6-9]|2\\d|3[01])\\..*")
                || h.startsWith("169.254.") || h.equals("0.0.0.0") || h.equals("[::1]") || !h.contains(".");
        if (internal) throw new IllegalArgumentException("The " + what + " link must point to a public website");
        return s;
    }
}
