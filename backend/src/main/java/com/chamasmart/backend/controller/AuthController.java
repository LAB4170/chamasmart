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
    private final com.chamasmart.backend.security.FirebaseTokenVerifier firebaseTokenVerifier;
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@RequestBody RegisterRequest request) {
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
        log.info("Received registration request");
        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Email is already in use"));
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
        String loginEmail = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(loginEmail).orElse(null);
        if (user != null && "google".equalsIgnoreCase(user.getAuthMethod())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("This account uses Google sign-in. Please continue with Google."));
        }
        if (user != null && Boolean.FALSE.equals(user.getIsActive())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("This account has been deactivated"));
        }
        if (user == null || request.getPassword() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
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
    public ResponseEntity<ApiResponse<AuthResponse>> firebaseSync(@RequestBody FirebaseSyncRequest request) {
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
        String email = identity.email();

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
                    passwordEncoder.encode(java.util.UUID.randomUUID() + "-" + java.util.UUID.randomUUID()),
                    "MEMBER", true, true, phone != null, "google"
            );
            return userRepository.save(newUser);
        });

        String token = jwtUtil.generateToken(CustomUserDetails.build(user));
        AuthResponse authResponse = new AuthResponse(user, new AuthResponse.TokenResponse(token, token));
        return ResponseEntity.ok(ApiResponse.success(authResponse, "Firebase user synced successfully"));
    }
}

