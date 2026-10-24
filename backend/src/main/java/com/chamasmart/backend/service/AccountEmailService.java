package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.EmailToken;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.mail.OutboundMail;
import com.chamasmart.backend.repository.EmailTokenRepository;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.RefreshTokenService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.Base64;
import java.util.Optional;

/** Email verification and password reset by one-time links. */
@Service
public class AccountEmailService {
    static final Duration VERIFY_TTL = Duration.ofHours(48);
    static final Duration RESET_TTL = Duration.ofHours(1);
    static final int MAX_PER_HOUR = 3;
    private static final SecureRandom RANDOM = new SecureRandom();

    public static class InvalidLinkException extends RuntimeException {}
    public static class TooManyException extends RuntimeException {}

    private final EmailTokenRepository tokens;
    private final UserRepository users;
    private final OutboundMail mail;
    private final PasswordEncoder encoder;
    private final RefreshTokenService refreshTokens;
    private final String frontendUrl;

    public AccountEmailService(EmailTokenRepository tokens, UserRepository users, OutboundMail mail, PasswordEncoder encoder,
                               RefreshTokenService refreshTokens,
                               @Value("${app.frontend-url:https://chamasmart.netlify.app}") String frontendUrl) {
        this.tokens = tokens; this.users = users; this.mail = mail; this.encoder = encoder; this.refreshTokens = refreshTokens;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    public boolean mailConfigured() { return mail.isConfigured(); }

    static String hash(String raw) {
        try {
            StringBuilder sb = new StringBuilder();
            for (byte b : MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8))) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    /** Creates a fresh link token; earlier unused ones of the same kind stop working. */
    String issue(User user, String purpose, Duration ttl) {
        if (tokens.countByUserIdAndPurposeAndCreatedAtAfter(user.getUserId(), purpose, ZonedDateTime.now().minusHours(1)) >= MAX_PER_HOUR) throw new TooManyException();
        tokens.findByUserIdAndPurposeAndUsedAtIsNull(user.getUserId(), purpose).forEach(t -> { t.setUsedAt(Instant.now()); tokens.save(t); });
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        tokens.save(EmailToken.builder().userId(user.getUserId()).purpose(purpose).tokenHash(hash(raw)).expiresAt(Instant.now().plus(ttl)).build());
        return raw;
    }

    /** Returns false when the message could not be sent. Never throws for a send failure. */
    @Transactional
    public boolean sendVerification(User user) {
        if (Boolean.TRUE.equals(user.getEmailVerified())) return true;
        String raw = issue(user, "VERIFY_EMAIL", VERIFY_TTL);
        String link = frontendUrl + "/verify-email?token=" + raw;
        return mail.send(user.getEmail(), "Confirm your email for ChamaSmart", body("Confirm your email address",
                "Hello " + HtmlUtils.htmlEscape(user.getFirstName() == null ? "" : user.getFirstName()) + ", please confirm this is your email address so you can be appointed as an official of a chama. The link works for 48 hours.",
                link, "Confirm my email"));
    }

    /** Only password accounts get a reset link; a Google account is told to use Google instead. */
    @Transactional
    public boolean sendReset(User user) {
        if ("google".equalsIgnoreCase(user.getAuthMethod())) {
            return mail.send(user.getEmail(), "Signing in to ChamaSmart", body("You sign in with Google",
                    "Someone asked to reset the password for this address. Your account uses Google, so there is no password to reset. Open ChamaSmart and choose Continue with Google. If this was not you, ignore this email.", null, null));
        }
        String raw = issue(user, "RESET_PASSWORD", RESET_TTL);
        String link = frontendUrl + "/reset-password?token=" + raw;
        return mail.send(user.getEmail(), "Reset your ChamaSmart password", body("Reset your password",
                "Someone asked to reset the password for this address. The link works for one hour and only once. If it was not you, ignore this email and your password stays the same.",
                link, "Choose a new password"));
    }

    @Transactional
    public User verify(String raw) {
        EmailToken t = usable(raw, "VERIFY_EMAIL");
        User u = users.findById(t.getUserId()).orElseThrow(InvalidLinkException::new);
        t.setUsedAt(Instant.now());
        tokens.save(t);
        u.setEmailVerified(true);
        return users.save(u);
    }

    /** Sets the new password, ends every session, and counts the address as verified because the person proved they own it. */
    @Transactional
    public User resetPassword(String raw, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) throw new IllegalArgumentException("Your new password must be at least 8 characters");
        EmailToken t = usable(raw, "RESET_PASSWORD");
        User u = users.findById(t.getUserId()).orElseThrow(InvalidLinkException::new);
        if (Boolean.FALSE.equals(u.getIsActive())) throw new InvalidLinkException();
        t.setUsedAt(Instant.now());
        tokens.save(t);
        u.setPasswordHash(encoder.encode(newPassword));
        u.setEmailVerified(true);
        if ("google".equalsIgnoreCase(u.getAuthMethod())) u.setAuthMethod("email");
        users.save(u);
        refreshTokens.signOutEverywhere(u.getUserId());
        return u;
    }

    private EmailToken usable(String raw, String purpose) {
        if (raw == null || raw.isBlank() || raw.length() > 100) throw new InvalidLinkException();
        EmailToken t = tokens.findByTokenHash(hash(raw)).orElseThrow(InvalidLinkException::new);
        if (!purpose.equals(t.getPurpose()) || t.getUsedAt() != null || t.getExpiresAt().isBefore(Instant.now())) throw new InvalidLinkException();
        return t;
    }

    @Scheduled(cron = "0 45 3 * * *")
    @Transactional
    public void purgeExpired() { tokens.deleteByExpiresAtBefore(Instant.now().minus(Duration.ofDays(7))); }

    private static String body(String heading, String text, String link, String button) {
        String btn = link == null ? "" : "<p><a href=\"" + link + "\" style=\"background:#0f766e;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block\">" + button + "</a></p>"
                + "<p style=\"color:#555;font-size:13px\">If the button does not work, copy this address into your browser:<br>" + link + "</p>";
        return "<div style=\"font-family:Arial,sans-serif;max-width:520px\"><h2>" + heading + "</h2><p>" + text + "</p>" + btn
                + "<p style=\"color:#777;font-size:12px\">ChamaSmart will never ask for your password or M-Pesa PIN by email.</p></div>";
    }
}
