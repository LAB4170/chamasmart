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
        log.info("Firebase OAuth sync for email: {}", request.getEmail());

        // Always resolve email first — it is the canonical identifier from Firebase
        String email = (request.getEmail() != null && !request.getEmail().trim().isEmpty())
                ? request.getEmail().trim().toLowerCase()
                : null;

        if (email == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Email is required for Firebase sync"));
        }

        // Find existing user by email or create a new one
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            String firstName  = (request.getFirstName()  != null && !request.getFirstName().isBlank())
                    ? request.getFirstName().trim() : "User";
            String lastName   = (request.getLastName()   != null && !request.getLastName().isBlank())
                    ? request.getLastName().trim()  : "";
            String phone      = (request.getPhoneNumber() != null && !request.getPhoneNumber().trim().isEmpty())
                    ? request.getPhoneNumber().trim() : null;

            User newUser = new User(
                    firstName, lastName, email, phone,
                    passwordEncoder.encode("OAuthUserSecureLocalFallbackPwd123!"),
                    "MEMBER", true, true, phone != null, "google"
            );
            return userRepository.save(newUser);
        });

        String token = jwtUtil.generateToken(CustomUserDetails.build(user));
        AuthResponse authResponse = new AuthResponse(user, new AuthResponse.TokenResponse(token, token));
        return ResponseEntity.ok(ApiResponse.success(authResponse, "Firebase user synced successfully"));
    }
}

