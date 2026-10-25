package com.chamasmart.backend.controller;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final com.chamasmart.backend.security.LoginAttemptService loginAttempts;
    private final com.chamasmart.backend.service.MfaService mfa;
    private final com.chamasmart.backend.security.FirebaseTokenVerifier firebaseTokenVerifier;
    private final com.chamasmart.backend.security.RefreshTokenService refreshTokens;
    private final com.chamasmart.backend.service.AuditTrailService audit;
    private final com.chamasmart.backend.service.GoogleAccountService googleAccounts;
    private final com.chamasmart.backend.service.AccountEmailService accountEmail;

    private AuthResponse sessionFor(User u, jakarta.servlet.http.HttpServletRequest req) {
        String access = jwtUtil.generateToken(CustomUserDetails.build(u));
        String refresh = refreshTokens.issue(u, req == null ? null : req.getHeader("User-Agent"));
        return new AuthResponse(u, new AuthResponse.TokenResponse(access, refresh));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@RequestBody RegisterRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String email = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Enter a valid email address"));
        }
        if (request.getPassword() == null || request.getPassword().length() < 8) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Your password must be at least 8 characters"));
        }
        if (request.getFirstName() == null || request.getFirstName().isBlank() || request.getLastName() == null || request.getLastName().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Enter your first and last name"));
        }
        if (!Boolean.TRUE.equals(request.getTermsAccepted())) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Please accept the terms and privacy notice to create an account"));
        }
        log.info("Received registration request");
        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("We couldn't create an account with those details. If you already have an account, sign in instead."));
        }
        User user = new User(
                request.getFirstName(),
                request.getLastName(),
                email,
                request.getPhoneNumber(),
                passwordEncoder.encode(request.getPassword()),
                "MEMBER",
                true,
                false,
                false,
                "email"
        );
        user.setTermsAcceptedAt(java.time.ZonedDateTime.now());
        User savedUser = userRepository.save(user);
        AuthResponse authResponse = sessionFor(savedUser, httpRequest);
        try { accountEmail.sendVerification(savedUser); } catch (RuntimeException e) { log.warn("Verification email was not sent after sign-up"); }
        audit.record(savedUser.getUserId(), "ACCOUNT_REGISTERED", "USER", savedUser.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authResponse, "User registered successfully"));
    }
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<?>> login(@RequestBody LoginRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String loginEmail = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
        String clientIp = com.chamasmart.backend.security.ClientIp.of(httpRequest);
        if (loginAttempts.isBlocked(clientIp, loginEmail)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(loginAttempts.retryAfterMinutes(clientIp, loginEmail) * 60))
                    .body(ApiResponse.error("Too many failed attempts. Please try again in " + loginAttempts.retryAfterMinutes(clientIp, loginEmail) + " minutes."));
        }
        User user = userRepository.findByEmail(loginEmail).orElse(null);
        // One message for every failure, so the response never says whether an email has an account or how it signs in.
        boolean passwordOk = user != null && user.getPasswordHash() != null && request.getPassword() != null
                && !"google".equalsIgnoreCase(user.getAuthMethod())
                && passwordEncoder.matches(request.getPassword(), user.getPasswordHash());
        if (!passwordOk) {
            loginAttempts.recordFailure(clientIp, loginEmail);
            audit.record(user == null ? null : user.getUserId(), "LOGIN_FAILED", "USER", user == null ? null : user.getUserId(), clientIp, null);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid email or password. If you signed up with Google, use Continue with Google."));
        }
        if (Boolean.FALSE.equals(user.getIsActive())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("This account has been deactivated"));
        }
        if (mfa.isEnabled(user.getUserId())) {
            // Password was right; the session is only issued after the second step.
            audit.record(user.getUserId(), "LOGIN_MFA_CHALLENGE", "USER", user.getUserId(), clientIp, null);
            return ResponseEntity.ok(ApiResponse.success(Map.of("mfa_required", true, "mfa_token", mfa.challengeFor(user.getUserId())), "Enter your authenticator code"));
        }
        loginAttempts.reset(clientIp, loginEmail);
        audit.record(user.getUserId(), "LOGIN", "USER", user.getUserId(), clientIp, null);
        return ResponseEntity.ok(ApiResponse.success(sessionFor(user, httpRequest), "Login successful"));
    }

    /** Second step of sign-in for people who turned on two-factor: the challenge from login plus a 6-digit or recovery code. */
    @PostMapping("/mfa/login")
    public ResponseEntity<ApiResponse<?>> mfaLogin(@RequestBody Map<String, String> body, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String clientIp = com.chamasmart.backend.security.ClientIp.of(httpRequest);
        Long userId = mfa.userFromChallenge(body.get("mfa_token"));
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("That sign-in has expired. Please start again."));
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || Boolean.FALSE.equals(user.getIsActive())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("That sign-in has expired. Please start again."));
        }
        String key = "mfa:" + user.getEmail();
        if (loginAttempts.isBlocked(clientIp, key)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(ApiResponse.error("Too many wrong codes. Please try again later."));
        }
        if (!mfa.verify(userId, body.get("code"))) {
            loginAttempts.recordFailure(clientIp, key);
            audit.record(userId, "LOGIN_MFA_FAILED", "USER", userId, clientIp, null);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("That code is not right."));
        }
        loginAttempts.reset(clientIp, key);
        audit.record(userId, "LOGIN", "USER", userId, clientIp, "two-factor");
        return ResponseEntity.ok(ApiResponse.success(sessionFor(user, httpRequest), "Login successful"));
    }

    @GetMapping("/mfa/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> mfaStatus(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(mfa.status(me.getUserId()), "OK"));
    }

    @PostMapping("/mfa/setup")
    public ResponseEntity<ApiResponse<Map<String, String>>> mfaSetup(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me) {
        try {
            User user = userRepository.findById(me.getUserId()).orElseThrow();
            return ResponseEntity.ok(ApiResponse.success(mfa.beginSetup(user), "Scan the code with your authenticator app"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/mfa/enable")
    public ResponseEntity<ApiResponse<Map<String, Object>>> mfaEnable(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me, @RequestBody Map<String, String> body, jakarta.servlet.http.HttpServletRequest httpRequest) {
        try {
            var codes = mfa.enable(me.getUserId(), body.get("code"));
            audit.record(me.getUserId(), "MFA_ENABLED", "USER", me.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
            return ResponseEntity.ok(ApiResponse.success(Map.of("recovery_codes", codes), "Two-factor sign-in is on. Save your recovery codes now."));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/mfa/disable")
    public ResponseEntity<ApiResponse<Void>> mfaDisable(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me, @RequestBody Map<String, String> body, jakarta.servlet.http.HttpServletRequest httpRequest) {
        try {
            mfa.disable(me.getUserId(), body.get("code"));
            audit.record(me.getUserId(), "MFA_DISABLED", "USER", me.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
            return ResponseEntity.ok(ApiResponse.success(null, "Two-factor sign-in is off"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/mfa/recovery-codes")
    public ResponseEntity<ApiResponse<Map<String, Object>>> mfaNewRecoveryCodes(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(ApiResponse.success(Map.of("recovery_codes", mfa.regenerateRecoveryCodes(me.getUserId(), body.get("code"))), "New recovery codes. The old ones no longer work."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Swaps a refresh token for a new access token and a new refresh token. Each refresh token works once. */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@RequestBody Map<String, String> body, jakarta.servlet.http.HttpServletRequest httpRequest) {
        var rotated = refreshTokens.rotate(body.get("refreshToken"), httpRequest.getHeader("User-Agent"));
        if (rotated.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Your session has ended. Please sign in again."));
        }
        User u = rotated.get().user();
        String access = jwtUtil.generateToken(CustomUserDetails.build(u));
        return ResponseEntity.ok(ApiResponse.success(new AuthResponse(u, new AuthResponse.TokenResponse(access, rotated.get().raw())), "Session renewed"));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody(required = false) Map<String, String> body) {
        refreshTokens.revoke(body == null ? null : body.get("refreshToken"));
        return ResponseEntity.ok(ApiResponse.success(null, "Signed out"));
    }

    /** Signs the person out on every device, including this one. */
    @PostMapping("/logout-all")
    public ResponseEntity<ApiResponse<Void>> logoutAll(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me, jakarta.servlet.http.HttpServletRequest httpRequest) {
        refreshTokens.signOutEverywhere(me.getUserId());
        audit.record(me.getUserId(), "SIGNED_OUT_EVERYWHERE", "USER", me.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
        return ResponseEntity.ok(ApiResponse.success(null, "Signed out on all devices"));
    }
    private static <T> ResponseEntity<ApiResponse<T>> notAvailable(String what) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error(what + " is not available yet"));
    }
    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestBody Map<String, String> payload, jakarta.servlet.http.HttpServletRequest httpRequest) {
        try {
            User u = accountEmail.verify(payload.get("token"));
            audit.record(u.getUserId(), "EMAIL_VERIFIED", "USER", u.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
            return ResponseEntity.ok(ApiResponse.success(null, "Your email address is confirmed"));
        } catch (com.chamasmart.backend.service.AccountEmailService.InvalidLinkException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("This link has expired or was already used. Ask for a new one from your profile."));
        }
    }
    @PostMapping("/resend-email-verification")
    public ResponseEntity<ApiResponse<Void>> resendEmailVerification(@org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails me) {
        User u = userRepository.findById(me.getUserId()).orElseThrow(() -> new RuntimeException("User not found"));
        if (Boolean.TRUE.equals(u.getEmailVerified())) return ResponseEntity.ok(ApiResponse.success(null, "Your email address is already confirmed"));
        if (!accountEmail.mailConfigured()) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(ApiResponse.error("Email sending isn't switched on yet. Please try again later."));
        try {
            boolean sent = accountEmail.sendVerification(u);
            if (!sent) return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ApiResponse.error("We couldn't send the email just now. Please try again in a few minutes."));
        } catch (com.chamasmart.backend.service.AccountEmailService.TooManyException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(ApiResponse.error("You have asked for several emails already. Check your inbox and spam folder, or try again in an hour."));
        }
        return ResponseEntity.ok(ApiResponse.success(null, "We sent a confirmation link to " + u.getEmail()));
    }
    /** The reply never says whether the address has an account. */
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@RequestBody Map<String, String> payload, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String email = payload.get("email") == null ? "" : payload.get("email").trim().toLowerCase();
        User u = email.isEmpty() ? null : userRepository.findByEmail(email).orElse(null);
        if (u != null && !Boolean.FALSE.equals(u.getIsActive())) {
            try {
                accountEmail.sendReset(u);
                audit.record(u.getUserId(), "PASSWORD_RESET_REQUESTED", "USER", u.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
            } catch (com.chamasmart.backend.service.AccountEmailService.TooManyException ignored) {
                // Too many recent requests: stay silent so the reply is identical.
            }
        }
        return ResponseEntity.ok(ApiResponse.success(null, "If that address has an account, we've emailed a link to reset the password. It works for one hour."));
    }
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@RequestBody Map<String, String> payload, jakarta.servlet.http.HttpServletRequest httpRequest) {
        try {
            User u = accountEmail.resetPassword(payload.get("token"), payload.get("newPassword"));
            audit.record(u.getUserId(), "PASSWORD_RESET", "USER", u.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
            return ResponseEntity.ok(ApiResponse.success(null, "Password changed. Please sign in with your new password."));
        } catch (com.chamasmart.backend.service.AccountEmailService.InvalidLinkException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("This link has expired or was already used. Ask for a new one."));
        }
    }
    @PostMapping("/verify-phone")
    public ResponseEntity<ApiResponse<Void>> verifyPhone(@RequestBody Map<String, String> payload) { return notAvailable("Phone verification"); }
    @PostMapping("/resend-phone-verification")
    public ResponseEntity<ApiResponse<Void>> resendPhoneVerification() { return notAvailable("Phone verification"); }
    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@RequestBody Map<String, String> payload) { return notAvailable("This password endpoint (use /users/change-password)"); }
    @PostMapping("/firebase-sync")
    public ResponseEntity<ApiResponse<AuthResponse>> firebaseSync(@RequestBody FirebaseSyncRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        // The email comes from the verified token, never from the request body.
        com.chamasmart.backend.security.FirebaseTokenVerifier.Identity identity;
        try {
            identity = firebaseTokenVerifier.verify(request.getIdToken());
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("We couldn't verify your Google sign-in. Please try again."));
        }
        if (!identity.emailVerified()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Your Google email address isn't verified"));
        }
        com.chamasmart.backend.service.GoogleAccountService.Result found;
        try {
            found = googleAccounts.resolve(identity, request.getFirstName(), request.getLastName(), request.getPhoneNumber());
        } catch (com.chamasmart.backend.service.GoogleAccountService.DeactivatedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("This account has been deactivated"));
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("We couldn't verify your Google sign-in. Please try again."));
        }
        User user = found.user();
        String ip = com.chamasmart.backend.security.ClientIp.of(httpRequest);
        audit.record(user.getUserId(), found.created() ? "ACCOUNT_REGISTERED_GOOGLE" : found.linked() ? "GOOGLE_LINKED_PASSWORD_REMOVED" : "LOGIN_GOOGLE", "USER", user.getUserId(), ip, null);
        return ResponseEntity.ok(ApiResponse.success(sessionFor(user, httpRequest), "Firebase user synced successfully"));
    }
}

