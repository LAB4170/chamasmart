package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    /** GET /users/profile — returns the currently authenticated user's profile */
    @GetMapping("/users/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProfile(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get profile for user ID: {}", currentUser.getUserId());
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(ApiResponse.success(buildUserMap(user), "Profile retrieved successfully"));
    }

    /** PUT /users/profile — update name and phone */
    @PutMapping("/users/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateProfile(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody Map<String, String> body) {
        log.info("REST request to update profile for user ID: {}", currentUser.getUserId());
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String fn = body.containsKey("firstName") ? body.get("firstName") : body.get("first_name");
        if (fn != null && !fn.isBlank()) user.setFirstName(fn);

        String ln = body.containsKey("lastName") ? body.get("lastName") : body.get("last_name");
        if (ln != null && !ln.isBlank()) user.setLastName(ln);

        String ph = body.containsKey("phoneNumber") ? body.get("phoneNumber") : body.get("phone_number");
        if (ph != null && !ph.isBlank()) user.setPhoneNumber(ph);

        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.success(buildUserMap(user), "Profile updated successfully"));
    }

    /** GET /users/search */
    @GetMapping("/users/search")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> searchUsers(
            @RequestParam String query) {
        log.info("REST request to search users with query: {}", query);
        String q = query.toLowerCase();
        List<Map<String, Object>> results = userRepository.findAll().stream()
                .filter(u -> u.getEmail().toLowerCase().contains(q)
                        || u.getFirstName().toLowerCase().contains(q)
                        || u.getLastName().toLowerCase().contains(q))
                .map(this::buildUserMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(results, "Search results"));
    }

    private Map<String, Object> buildUserMap(User u) {
        Map<String, Object> m = new HashMap<>();
        m.put("user_id", u.getUserId());
        m.put("first_name", u.getFirstName());
        m.put("last_name", u.getLastName());
        m.put("email", u.getEmail());
        m.put("phone_number", u.getPhoneNumber());
        m.put("role", u.getRole());
        m.put("is_active", u.getIsActive());
        m.put("email_verified", u.getEmailVerified());
        m.put("auth_method", u.getAuthMethod());
        m.put("trust_score", u.getTrustScore());
        m.put("created_at", u.getCreatedAt());
        return m;
    }
}
