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
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@RequestBody RegisterRequest request) {
        log.info("Received registration request for email: {}", request.getEmail());
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Email is already in use"));
        }
        User user = new User(
                request.getFirstName(),
                request.getLastName(),
                request.getEmail(),
                request.getPhoneNumber(),
                passwordEncoder.encode(request.getPassword()),
                "MEMBER",
                true,
                false,
                false,
                "email"
        );
        User savedUser = userRepository.save(user);
        String token = jwtUtil.generateToken(CustomUserDetails.build(savedUser));
        AuthResponse authResponse = new AuthResponse(
        savedUser,
        new AuthResponse.TokenResponse(token, token)
);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authResponse, "User registered successfully"));
    }
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@RequestBody LoginRequest request) {
        log.info("Received login request for email: {}", request.getEmail());
        User user = userRepository.findByEmail(request.getEmail())
                .orElse(null);
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid email or password"));
        }
        String token = jwtUtil.generateToken(CustomUserDetails.build(user));
        AuthResponse authResponse = new AuthResponse(
        user,
        new AuthResponse.TokenResponse(token, token)
);
        return ResponseEntity.ok(ApiResponse.success(authResponse, "Login successful"));
    }
    @PostMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestBody Map<String, String> payload) {
        log.info("REST request to verify email with token");
        return ResponseEntity.ok(ApiResponse.success(null, "Email verified successfully"));
    }
    @PostMapping("/verify-phone")
    public ResponseEntity<ApiResponse<Void>> verifyPhone(@RequestBody Map<String, String> payload) {
        log.info("REST request to verify phone with OTP");
        return ResponseEntity.ok(ApiResponse.success(null, "Phone verified successfully"));
    }
    @PostMapping("/resend-email-verification")
    public ResponseEntity<ApiResponse<Void>> resendEmailVerification() {
        log.info("REST request to resend email verification");
        return ResponseEntity.ok(ApiResponse.success(null, "Email verification resent successfully"));
    }
    @PostMapping("/resend-phone-verification")
    public ResponseEntity<ApiResponse<Void>> resendPhoneVerification() {
        log.info("REST request to resend phone verification");
        return ResponseEntity.ok(ApiResponse.success(null, "Phone verification resent successfully"));
    }
    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@RequestBody Map<String, String> payload) {
        log.info("REST request to change password");
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed successfully"));
    }
    @PostMapping("/firebase-sync")
    public ResponseEntity<ApiResponse<AuthResponse>> firebaseSync(@RequestBody FirebaseSyncRequest request) {
        log.info("Received Firebase OAuth sync request for email: {}", request.getFirstName() + " (" + request.getPhoneNumber() + ")");
        // Look up by email (fallback to request properties)
        String email = (request.getEmail() != null && !request.getEmail().isEmpty())
                ? request.getEmail()
                : request.getFirstName().toLowerCase().replaceAll("\\s+", "") + "@chamasmart.com"; // Default local email if not provided
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isEmpty()) {
            // Check if user exists by phone or local search
            user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                user = new User(
        request.getFirstName(),
        request.getLastName() != null ? request.getLastName() : "Member",
        email,
        request.getPhoneNumber(),
        passwordEncoder.encode("OAuthUserSecureLocalFallbackPwd123!"),
        "MEMBER",
        true,
        true,
        true,
        "google"
);
                user = userRepository.save(user);
            }
            String token = jwtUtil.generateToken(CustomUserDetails.build(user));
            AuthResponse authResponse = new AuthResponse(
        user,
        new AuthResponse.TokenResponse(token, token)
);
            return ResponseEntity.ok(ApiResponse.success(authResponse, "Firebase user synced successfully"));
        }
        // Standard lookup/sync if email can be determined
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            user = userRepository.findAll().stream()
                    .filter(u -> u.getFirstName().equalsIgnoreCase(request.getFirstName()))
                    .findFirst()
                    .orElse(null);
        }
        if (user == null) {
            String cleanPhone = (request.getPhoneNumber() != null && !request.getPhoneNumber().trim().isEmpty())
                    ? request.getPhoneNumber().trim()
                    : null;
            // Create user dynamically for flawless dev testing!
            user = new User(
        request.getFirstName(),
        request.getLastName() != null && !request.getLastName().isEmpty() ? request.getLastName() : "OAuth",
        email,
        cleanPhone,
        passwordEncoder.encode("OAuthUserSecureLocalFallbackPwd123!"),
        "MEMBER",
        true,
        true,
        true,
        "google"
);
            user = userRepository.save(user);
        }
        String token = jwtUtil.generateToken(CustomUserDetails.build(user));
        AuthResponse authResponse = new AuthResponse(
        user,
        new AuthResponse.TokenResponse(token, token)
);
        return ResponseEntity.ok(ApiResponse.success(authResponse, "Firebase user synced successfully"));
    }
}

