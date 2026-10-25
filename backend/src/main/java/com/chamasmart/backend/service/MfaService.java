package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.MfaRecoveryCode;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.domain.UserMfa;
import com.chamasmart.backend.mfa.Totp;
import com.chamasmart.backend.repository.MfaRecoveryCodeRepository;
import com.chamasmart.backend.repository.UserMfaRepository;
import com.chamasmart.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Authenticator-app two-factor sign-in. A person enrols by scanning a secret, proves it with one code, and is given
 * single-use recovery codes. Codes are accepted once per 30-second step, so a captured code cannot be replayed.
 */
@Service
@RequiredArgsConstructor
public class MfaService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long CHALLENGE_SECONDS = 300;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final UserMfaRepository mfaRepository;
    private final MfaRecoveryCodeRepository recoveryRepository;
    private final JwtUtil jwtUtil;

    /** When on, officials must have two-factor on before they can act as an official. */
    @Value("${app.security.mfa.enforce-for-officials:false}")
    private boolean enforceForOfficials;

    @Value("${app.security.mfa.issuer:ChamaSmart}")
    private String issuer = "ChamaSmart";

    public boolean isEnabled(Long userId) {
        return mfaRepository.findById(userId).map(UserMfa::isEnabled).orElse(false);
    }

    public boolean enforcesOfficials() { return enforceForOfficials; }

    public Map<String, Object> status(Long userId) {
        boolean on = isEnabled(userId);
        return Map.of("enabled", on, "recovery_codes_left", on ? recoveryRepository.countByUserIdAndUsedAtIsNull(userId) : 0);
    }

    /** Starts (or restarts) enrolment. Nothing changes for sign-in until the first code is confirmed. */
    @Transactional
    public Map<String, String> beginSetup(User user) {
        UserMfa existing = mfaRepository.findById(user.getUserId()).orElse(null);
        if (existing != null && existing.isEnabled()) throw new IllegalStateException("Two-factor sign-in is already on");
        String secret = Totp.newSecret();
        mfaRepository.save(UserMfa.builder().userId(user.getUserId()).secret(secret).enabled(false).lastUsedStep(0).createdAt(Instant.now()).build());
        return Map.of("secret", secret, "otpauth_uri", Totp.otpauthUri(issuer, user.getEmail(), secret));
    }

    /** Confirms the first code, turns two-factor on and returns the recovery codes. They are shown once. */
    @Transactional
    public List<String> enable(Long userId, String code) {
        UserMfa mfa = mfaRepository.findById(userId).orElseThrow(() -> new IllegalStateException("Start setup first"));
        if (mfa.isEnabled()) throw new IllegalStateException("Two-factor sign-in is already on");
        long step = Totp.match(mfa.getSecret(), code, Instant.now().getEpochSecond());
        if (step < 0) throw new IllegalArgumentException("That code is not right. Check the time on your phone and try again.");
        mfa.setEnabled(true);
        mfa.setConfirmedAt(Instant.now());
        mfa.setLastUsedStep(step);
        mfaRepository.save(mfa);
        return issueRecoveryCodes(userId);
    }

    @Transactional
    public List<String> regenerateRecoveryCodes(Long userId, String code) {
        if (!verify(userId, code)) throw new IllegalArgumentException("That code is not right");
        return issueRecoveryCodes(userId);
    }

    @Transactional
    public void disable(Long userId, String code) {
        if (!verify(userId, code)) throw new IllegalArgumentException("That code is not right");
        recoveryRepository.deleteByUserId(userId);
        mfaRepository.deleteById(userId);
    }

    /** Accepts an authenticator code or an unused recovery code. */
    @Transactional
    public boolean verify(Long userId, String code) {
        UserMfa mfa = mfaRepository.findById(userId).filter(UserMfa::isEnabled).orElse(null);
        if (mfa == null || code == null) return false;
        String trimmed = code.trim().replace(" ", "");
        if (trimmed.matches("\\d{6}")) {
            long step = Totp.match(mfa.getSecret(), trimmed, Instant.now().getEpochSecond());
            if (step < 0 || step <= mfa.getLastUsedStep()) return false;
            mfa.setLastUsedStep(step);
            mfaRepository.save(mfa);
            return true;
        }
        String normalised = trimmed.replace("-", "").toUpperCase();
        var found = recoveryRepository.findByUserIdAndCodeHashAndUsedAtIsNull(userId, hash(normalised));
        if (found.isEmpty()) return false;
        found.get().setUsedAt(Instant.now());
        recoveryRepository.save(found.get());
        return true;
    }

    /** Signed, short-lived proof that the password step succeeded. It cannot be used as a session. */
    public String challengeFor(Long userId) {
        String payload = userId + ":" + (Instant.now().getEpochSecond() + CHALLENGE_SECONDS);
        String body = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return body + "." + jwtUtil.sign("mfa-challenge", body);
    }

    /** The user id inside a valid, unexpired challenge, or null. */
    public Long userFromChallenge(String challenge) {
        if (challenge == null || !challenge.contains(".")) return null;
        String[] parts = challenge.split("\\.", 2);
        if (!MessageDigest.isEqual(jwtUtil.sign("mfa-challenge", parts[0]).getBytes(StandardCharsets.UTF_8), parts[1].getBytes(StandardCharsets.UTF_8))) return null;
        try {
            String[] payload = new String(java.util.Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split(":");
            if (Instant.now().getEpochSecond() > Long.parseLong(payload[1])) return null;
            return Long.parseLong(payload[0]);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private List<String> issueRecoveryCodes(Long userId) {
        recoveryRepository.deleteByUserId(userId);
        List<String> shown = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            StringBuilder raw = new StringBuilder();
            for (int j = 0; j < 10; j++) raw.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            recoveryRepository.save(MfaRecoveryCode.builder().userId(userId).codeHash(hash(raw.toString())).build());
            shown.add(raw.substring(0, 5) + "-" + raw.substring(5));
        }
        return shown;
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
