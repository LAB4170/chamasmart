package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.FirebaseTokenVerifier.Identity;
import com.chamasmart.backend.security.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GoogleAccountServiceTest {
    @Mock UserRepository users;
    @Mock PasswordEncoder encoder;
    @Mock RefreshTokenService tokens;
    GoogleAccountService service;

    @BeforeEach
    void setUp() {
        when(encoder.encode(any())).thenReturn("HASH-RANDOM");
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));
        service = new GoogleAccountService(users, encoder, tokens);
    }

    private static Identity id(String email, String name) { return new Identity("uid", email, true, name); }

    @Test
    void newAccountUsesTheVerifiedNameLowercasesEmailAndRecordsTerms() {
        when(users.findByEmail("jane.doe@gmail.com")).thenReturn(Optional.empty());
        var r = service.resolve(id("Jane.Doe@Gmail.com", "Jane Mary Doe"), "Evil", "Hacker", null);
        assertTrue(r.created());
        assertEquals("Jane", r.user().getFirstName());
        assertEquals("Mary Doe", r.user().getLastName());
        assertEquals("jane.doe@gmail.com", r.user().getEmail());
        assertEquals("google", r.user().getAuthMethod());
        assertTrue(r.user().getEmailVerified());
        assertNotNull(r.user().getTermsAcceptedAt());
    }

    @Test
    void clientNamesAreOnlyAFallback() {
        var parts = GoogleAccountService.splitName(null, "Sam", "Otieno");
        assertEquals("Sam", parts[0]); assertEquals("Otieno", parts[1]);
        assertEquals("User", GoogleAccountService.splitName("  ", null, null)[0]);
        assertEquals("Cher", GoogleAccountService.splitName("Cher", "x", "y")[0]);
    }

    @Test
    void existingPasswordAccountIsLinkedByDiscardingThePasswordAndEndingSessions() {
        User squatted = new User("Mallory", "X", "victim@gmail.com", null, "ATTACKER-PASSWORD-HASH", "MEMBER", true, false, false, "email");
        squatted.setUserId(5L);
        when(users.findByEmail("victim@gmail.com")).thenReturn(Optional.of(squatted));
        var r = service.resolve(id("victim@gmail.com", "Real Victim"), null, null, null);
        assertTrue(r.linked());
        assertFalse(r.created());
        assertEquals("HASH-RANDOM", squatted.getPasswordHash());
        assertEquals("google", squatted.getAuthMethod());
        assertTrue(squatted.getEmailVerified());
        verify(tokens).signOutEverywhere(5L);
    }

    @Test
    void returningGoogleUserIsNotDisturbed() {
        User u = new User("Jane", "Doe", "jane@gmail.com", null, "H", "MEMBER", true, true, false, "google");
        u.setUserId(6L);
        when(users.findByEmail("jane@gmail.com")).thenReturn(Optional.of(u));
        var r = service.resolve(id("jane@gmail.com", "Jane Doe"), null, null, null);
        assertFalse(r.linked()); assertFalse(r.created());
        verifyNoInteractions(tokens);
    }

    @Test
    void deactivatedAccountsCannotSignInWithGoogle() {
        User u = new User("Jane", "Doe", "jane@gmail.com", null, "H", "MEMBER", false, true, false, "google");
        when(users.findByEmail("jane@gmail.com")).thenReturn(Optional.of(u));
        assertThrows(GoogleAccountService.DeactivatedException.class, () -> service.resolve(id("jane@gmail.com", "Jane"), null, null, null));
    }

    @Test
    void aTokenWithoutAnEmailIsRefused() {
        assertThrows(SecurityException.class, () -> service.resolve(id(" ", "Jane"), null, null, null));
    }
}
