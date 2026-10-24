package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.EmailToken;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.mail.OutboundMail;
import com.chamasmart.backend.repository.EmailTokenRepository;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;
import java.util.regex.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AccountEmailServiceTest {
    EmailTokenRepository tokens = mock(EmailTokenRepository.class);
    UserRepository users = mock(UserRepository.class);
    PasswordEncoder enc = mock(PasswordEncoder.class);
    RefreshTokenService refresh = mock(RefreshTokenService.class);
    List<String[]> sent = new ArrayList<>();
    List<EmailToken> store = new ArrayList<>();
    OutboundMail mail = new OutboundMail() {
        public boolean send(String to, String subject, String html) { sent.add(new String[]{to, subject, html}); return true; }
        public boolean isConfigured() { return true; }
    };
    AccountEmailService svc;
    User u;

    @BeforeEach
    void setUp() {
        svc = new AccountEmailService(tokens, users, mail, enc, refresh, "https://app.test");
        u = new User(); u.setUserId(1L); u.setEmail("a@b.c"); u.setFirstName("Amina"); u.setAuthMethod("email");
        when(tokens.save(any())).thenAnswer(i -> { store.add(i.getArgument(0)); return i.getArgument(0); });
        when(tokens.findByTokenHash(anyString())).thenAnswer(i -> store.stream().filter(t -> t.getTokenHash().equals(i.getArgument(0))).findFirst());
        when(users.findById(1L)).thenReturn(Optional.of(u));
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));
        when(enc.encode(anyString())).thenReturn("HASHED");
    }

    String rawToken() {
        Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(sent.get(sent.size() - 1)[2]);
        assertTrue(m.find());
        return m.group(1);
    }

    @Test
    void storesOnlyHashAndVerifiesOnce() {
        svc.sendVerification(u);
        String raw = rawToken();
        assertTrue(store.stream().noneMatch(t -> t.getTokenHash().equals(raw)));
        svc.verify(raw);
        assertTrue(u.getEmailVerified());
        assertThrows(AccountEmailService.InvalidLinkException.class, () -> svc.verify(raw));
    }

    @Test
    void expiredLinkRejected() {
        svc.sendVerification(u);
        String raw = rawToken();
        store.get(0).setExpiresAt(Instant.now().minusSeconds(5));
        assertThrows(AccountEmailService.InvalidLinkException.class, () -> svc.verify(raw));
    }

    @Test
    void resetChangesPasswordAndSignsOutEverywhere() {
        svc.sendReset(u);
        svc.resetPassword(rawToken(), "newpassword1");
        assertEquals("HASHED", u.getPasswordHash());
        verify(refresh).signOutEverywhere(1L);
        assertTrue(u.getEmailVerified());
    }

    @Test
    void shortPasswordRejected() {
        svc.sendReset(u);
        assertThrows(IllegalArgumentException.class, () -> svc.resetPassword(rawToken(), "short"));
    }

    @Test
    void garbageTokenRejected() {
        assertThrows(AccountEmailService.InvalidLinkException.class, () -> svc.verify("nope"));
        assertThrows(AccountEmailService.InvalidLinkException.class, () -> svc.verify(null));
    }

    @Test
    void rateLimited() {
        when(tokens.countByUserIdAndPurposeAndCreatedAtAfter(eq(1L), any(), any())).thenReturn(3L);
        assertThrows(AccountEmailService.TooManyException.class, () -> svc.sendReset(u));
        assertTrue(sent.isEmpty());
    }
}
