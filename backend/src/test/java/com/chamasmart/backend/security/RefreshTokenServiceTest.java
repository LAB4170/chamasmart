package com.chamasmart.backend.security;

import com.chamasmart.backend.domain.RefreshToken;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.repository.RefreshTokenRepository;
import com.chamasmart.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class RefreshTokenServiceTest {
    private RefreshTokenRepository repo;
    private UserRepository users;
    private RefreshTokenService svc;
    private final Map<String, RefreshToken> store = new HashMap<>();
    private User user;

    @BeforeEach
    void setUp() {
        repo = mock(RefreshTokenRepository.class);
        users = mock(UserRepository.class);
        svc = new RefreshTokenService(repo, users);
        ReflectionTestUtils.setField(svc, "refreshDays", 30L);
        user = User.builder().userId(7L).email("a@b.co").firstName("A").lastName("B").build();
        when(repo.save(any(RefreshToken.class))).thenAnswer(i -> { RefreshToken t = i.getArgument(0); store.put(t.getToken(), t); return t; });
        when(repo.findByToken(anyString())).thenAnswer(i -> Optional.ofNullable(store.get((String) i.getArgument(0))));
        when(repo.findByUserUserIdAndRevokedFalse(anyLong())).thenAnswer(i -> store.values().stream().filter(t -> !t.isRevoked()).toList());
        when(users.findById(7L)).thenReturn(Optional.of(user));
    }

    @Test
    void storesOnlyAHashNeverTheRawToken() {
        String raw = svc.issue(user, "test");
        assertFalse(store.containsKey(raw));
        assertTrue(store.containsKey(RefreshTokenService.hash(raw)));
    }

    @Test
    void rotationGivesANewTokenAndRetiresTheOldOne() {
        String raw = svc.issue(user, "test");
        var next = svc.rotate(raw, "test");
        assertTrue(next.isPresent());
        assertNotEquals(raw, next.get().raw());
        assertTrue(store.get(RefreshTokenService.hash(raw)).isRevoked());
    }

    @Test
    void reusingAnOldTokenEndsEverySession() {
        String raw = svc.issue(user, "test");
        String newer = svc.rotate(raw, "test").orElseThrow().raw();
        assertTrue(svc.rotate(raw, "attacker").isEmpty());
        assertTrue(svc.rotate(newer, "test").isEmpty(), "the stolen-token alarm must also end the real session");
        assertTrue(user.getTokenVersion() >= 1);
    }

    @Test
    void unknownBlankAndExpiredTokensAreRefused() {
        assertTrue(svc.rotate("nope", null).isEmpty());
        assertTrue(svc.rotate("", null).isEmpty());
        String raw = svc.issue(user, null);
        store.get(RefreshTokenService.hash(raw)).setExpiresAt(java.time.Instant.now().minusSeconds(5));
        assertTrue(svc.rotate(raw, null).isEmpty());
    }

    @Test
    void deactivatedAccountsCannotRefresh() {
        String raw = svc.issue(user, null);
        user.setIsActive(false);
        assertTrue(svc.rotate(raw, null).isEmpty());
    }

    @Test
    void signingOutEverywhereBumpsTheTokenVersion() {
        svc.issue(user, null);
        svc.signOutEverywhere(7L);
        assertEquals(1, user.getTokenVersion());
        assertTrue(store.values().stream().allMatch(RefreshToken::isRevoked));
    }
}
