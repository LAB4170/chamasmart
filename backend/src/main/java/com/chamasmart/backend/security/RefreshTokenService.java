package com.chamasmart.backend.security;

import com.chamasmart.backend.domain.RefreshToken;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.repository.RefreshTokenRepository;
import com.chamasmart.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Long-lived refresh tokens that renew short-lived access tokens. Only a hash is stored. Each token works once: using it
 * issues a new one. If an old, already-used token shows up again, someone copied it, so every session of that user ends.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {
    private final RefreshTokenRepository repo;
    private final UserRepository users;
    @Value("${app.security.jwt.refresh-days:30}")
    private long refreshDays;
    private static final SecureRandom RANDOM = new SecureRandom();

    public record Issued(String raw, User user) {}

    static String hash(String raw) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    @Transactional
    public String issue(User user, String userAgent) {
        byte[] b = new byte[48];
        RANDOM.nextBytes(b);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        RefreshToken t = new RefreshToken();
        t.setToken(hash(raw));
        t.setUser(user);
        t.setExpiresAt(Instant.now().plus(refreshDays, ChronoUnit.DAYS));
        t.setUserAgent(userAgent);
        repo.save(t);
        return raw;
    }

    /** Swaps a valid refresh token for a new one. Empty when the token is unknown, expired or already used. */
    @Transactional
    public Optional<Issued> rotate(String raw, String userAgent) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        Optional<RefreshToken> found = repo.findByToken(hash(raw));
        if (found.isEmpty()) return Optional.empty();
        RefreshToken t = found.get();
        // The stored link is a lazy proxy; load the real user so it can be returned to the client.
        User user = (User) org.hibernate.Hibernate.unproxy(t.getUser());
        if (t.isRevoked()) {
            signOutEverywhere(user.getUserId());
            return Optional.empty();
        }
        if (t.getExpiresAt().isBefore(Instant.now()) || Boolean.FALSE.equals(user.getIsActive())) return Optional.empty();
        t.setRevoked(true);
        repo.save(t);
        return Optional.of(new Issued(issue(user, userAgent), user));
    }

    @Transactional
    public void revoke(String raw) {
        if (raw == null || raw.isBlank()) return;
        repo.findByToken(hash(raw)).ifPresent(t -> { t.setRevoked(true); repo.save(t); });
    }

    /** Ends every session: refresh tokens are revoked and all access tokens issued so far stop working. */
    @Transactional
    public void signOutEverywhere(Long userId) {
        repo.findByUserUserIdAndRevokedFalse(userId).forEach(t -> { t.setRevoked(true); repo.save(t); });
        users.findById(userId).ifPresent(u -> {
            u.setTokenVersion((u.getTokenVersion() == null ? 0 : u.getTokenVersion()) + 1);
            users.save(u);
        });
    }

    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpired() {
        repo.deleteByExpiresAtBefore(Instant.now().minus(7, ChronoUnit.DAYS));
    }
}
