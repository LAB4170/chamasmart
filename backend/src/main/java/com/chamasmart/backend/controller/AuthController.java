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
    private final com.chamasmart.backend.security.FirebaseTokenVerifier firebaseTokenVerifier;
    private final com.chamasmart.backend.security.RefreshTokenService refreshTokens;
    private final com.chamasmart.backend.service.AuditTrailService audit;
    private final com.chamasmart.backend.service.GoogleAccountService googleAccounts;

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
        audit.record(savedUser.getUserId(), "ACCOUNT_REGISTERED", "USER", savedUser.getUserId(), com.chamasmart.backend.security.ClientIp.of(httpRequest), null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authResponse, "User registered successfully"));
    }
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@RequestBody LoginRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
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
        loginAttempts.reset(clientIp, loginEmail);
        audit.record(user.getUserId(), "LOGIN", "USER", user.getUserId(), clientIp, null);
        return ResponseEntity.ok(ApiResponse.success(sessionFor(user, httpRequest), "Login successful"));
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
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestBody Map<String, String> payload) { return notAvailable("Email verification"); }
    @PostMapping("/verify-phone")
    public ResponseEntity<ApiResponse<Void>> verifyPhone(@RequestBody Map<String, String> payload) { return notAvailable("Phone verification"); }
    @PostMapping("/resend-email-verification")
    public ResponseEntity<ApiResponse<Void>> resendEmailVerification() { return notAvailable("Email verification"); }
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

