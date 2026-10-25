package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.MfaRecoveryCode;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.domain.UserMfa;
import com.chamasmart.backend.mfa.Totp;
import com.chamasmart.backend.repository.MfaRecoveryCodeRepository;
import com.chamasmart.backend.repository.UserMfaRepository;
import com.chamasmart.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MfaServiceTest {
    UserMfaRepository mfaRepo = mock(UserMfaRepository.class);
    MfaRecoveryCodeRepository recoveryRepo = mock(MfaRecoveryCodeRepository.class);
    JwtUtil jwt = mock(JwtUtil.class);
    MfaService service;
    Map<Long, UserMfa> store = new HashMap<>();
    List<MfaRecoveryCode> codes = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new MfaService(mfaRepo, recoveryRepo, jwt);
        when(mfaRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(store.get(i.getArgument(0))));
        when(mfaRepo.save(any())).thenAnswer(i -> { UserMfa m = i.getArgument(0); store.put(m.getUserId(), m); return m; });
        doAnswer(i -> store.remove(i.getArgument(0))).when(mfaRepo).deleteById(anyLong());
        when(recoveryRepo.save(any())).thenAnswer(i -> { MfaRecoveryCode c = i.getArgument(0); codes.add(c); return c; });
        doAnswer(i -> { codes.clear(); return null; }).when(recoveryRepo).deleteByUserId(anyLong());
        when(recoveryRepo.findByUserIdAndCodeHashAndUsedAtIsNull(anyLong(), anyString())).thenAnswer(i ->
                codes.stream().filter(c -> c.getCodeHash().equals(i.getArgument(1)) && c.getUsedAt() == null).findFirst());
        when(jwt.sign(anyString(), anyString())).thenAnswer(i -> "sig-" + i.getArgument(1));
    }

    private User user() { return User.builder().userId(7L).email("a@b.co").build(); }

    private String currentCode(String secret) { return Totp.codeFor(secret, Totp.stepAt(Instant.now().getEpochSecond())); }

    @Test
    void enrolmentTurnsOnOnlyAfterAValidCodeAndReturnsTenRecoveryCodes() {
        String secret = service.beginSetup(user()).get("secret");
        assertFalse(service.isEnabled(7L));
        assertThrows(IllegalArgumentException.class, () -> service.enable(7L, "000000"));
        assertFalse(service.isEnabled(7L));

        List<String> recovery = service.enable(7L, currentCode(secret));
        assertTrue(service.isEnabled(7L));
        assertEquals(10, recovery.size());
        assertEquals(10, codes.size());
        assertTrue(codes.stream().noneMatch(c -> recovery.contains(c.getCodeHash())), "only hashes are stored");
    }

    @Test
    void aCodeCannotBeUsedTwice() {
        String secret = service.beginSetup(user()).get("secret");
        service.enable(7L, currentCode(secret));
        // The code used to enrol is already spent; a login in the same 30 seconds needs the next step.
        assertFalse(service.verify(7L, currentCode(secret)));
        long next = Totp.stepAt(Instant.now().getEpochSecond()) + 1;
        assertTrue(service.verify(7L, Totp.codeFor(secret, next)));
        assertFalse(service.verify(7L, Totp.codeFor(secret, next)), "replay of the same step is refused");
    }

    @Test
    void recoveryCodesWorkOnce() {
        String secret = service.beginSetup(user()).get("secret");
        String one = service.enable(7L, currentCode(secret)).get(0);
        assertTrue(service.verify(7L, one));
        assertFalse(service.verify(7L, one));
        assertFalse(service.verify(7L, "AAAAA-AAAAA"));
    }

    @Test
    void disableNeedsAValidCode() {
        String secret = service.beginSetup(user()).get("secret");
        service.enable(7L, currentCode(secret));
        assertThrows(IllegalArgumentException.class, () -> service.disable(7L, "123456"));
        assertTrue(service.isEnabled(7L));
        String recovery = "";
        // A fresh recovery code is accepted as proof.
        List<String> fresh = service.regenerateRecoveryCodes(7L, Totp.codeFor(secret, Totp.stepAt(Instant.now().getEpochSecond()) + 1));
        service.disable(7L, fresh.get(0));
        assertFalse(service.isEnabled(7L));
    }

    @Test
    void challengeRoundTripsAndRejectsTampering() {
        String challenge = service.challengeFor(7L);
        assertEquals(7L, service.userFromChallenge(challenge));
        assertNull(service.userFromChallenge(challenge + "x"));
        assertNull(service.userFromChallenge("nonsense"));
        assertNull(service.userFromChallenge(null));
    }

    @Test
    void cannotStartSetupTwice() {
        String secret = service.beginSetup(user()).get("secret");
        service.enable(7L, currentCode(secret));
        assertThrows(IllegalStateException.class, () -> service.beginSetup(user()));
    }
}
