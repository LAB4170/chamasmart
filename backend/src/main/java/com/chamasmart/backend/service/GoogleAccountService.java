package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.FirebaseTokenVerifier;
import com.chamasmart.backend.security.RefreshTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * Finds or creates the account for a verified Google identity.
 * Names come from the verified token, never from the request. A Google sign-in proves control of the mailbox, so if the address
 * already has a password account, that password is discarded and every session ended: otherwise someone who registered a
 * victim's address first (nothing verifies addresses at sign-up) could keep access after the real owner signs in with Google.
 */
@Service
@RequiredArgsConstructor
public class GoogleAccountService {
    public record Result(User user, boolean created, boolean linked) {}

    /** The account exists but is switched off. */
    public static class DeactivatedException extends RuntimeException {}

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokens;

    @Transactional
    public Result resolve(FirebaseTokenVerifier.Identity identity, String fallbackFirst, String fallbackLast, String phone) {
        String email = identity.email() == null ? "" : identity.email().trim().toLowerCase();
        if (email.isEmpty()) throw new SecurityException("The Google account has no email address");
        User existing = users.findByEmail(email).orElse(null);
        if (existing == null) {
            String[] parts = splitName(identity.name(), fallbackFirst, fallbackLast);
            String cleanPhone = phone == null || phone.isBlank() ? null : phone.trim();
            User u = new User(parts[0], parts[1], email, cleanPhone, randomHash(), "MEMBER", true, true, false, "google");
            u.setTermsAcceptedAt(ZonedDateTime.now());
            return new Result(users.save(u), true, false);
        }
        if (Boolean.FALSE.equals(existing.getIsActive())) throw new DeactivatedException();
        boolean linked = false;
        if (!"google".equalsIgnoreCase(existing.getAuthMethod())) {
            existing.setPasswordHash(randomHash());
            existing.setAuthMethod("google");
            existing.setEmailVerified(true);
            users.save(existing);
            refreshTokens.signOutEverywhere(existing.getUserId());
            linked = true;
        } else if (!Boolean.TRUE.equals(existing.getEmailVerified())) {
            existing.setEmailVerified(true);
            users.save(existing);
        }
        return new Result(existing, false, linked);
    }

    /** First and last name from the verified display name; the client's values are only a fallback when Google gives none. */
    static String[] splitName(String display, String fallbackFirst, String fallbackLast) {
        String d = display == null ? "" : display.trim().replaceAll("\\s+", " ");
        if (!d.isEmpty()) {
            int i = d.indexOf(' ');
            String first = i < 0 ? d : d.substring(0, i);
            String last = i < 0 ? "" : d.substring(i + 1);
            return new String[]{clip(first), clip(last)};
        }
        String f = fallbackFirst == null || fallbackFirst.isBlank() ? "User" : fallbackFirst;
        return new String[]{clip(f), clip(fallbackLast == null ? "" : fallbackLast)};
    }

    private static String clip(String s) {
        String t = s.trim();
        return t.length() > 60 ? t.substring(0, 60) : t;
    }

    private String randomHash() {
        return passwordEncoder.encode(UUID.randomUUID() + "-" + UUID.randomUUID());
    }
}
