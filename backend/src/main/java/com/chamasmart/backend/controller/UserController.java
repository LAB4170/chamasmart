package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.CustomUserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.chamasmart.backend.service.ProfilePictureService;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
@RestController
@RequiredArgsConstructor
@Slf4j
public class UserController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProfilePictureService profilePictureService;
    private final com.chamasmart.backend.security.RefreshTokenService refreshTokens;
    private final com.chamasmart.backend.service.AuditTrailService audit;
    private final com.chamasmart.backend.repository.LoanRepository loanRepository;
    private final com.chamasmart.backend.repository.ChamaMemberRepository chamaMemberRepository;
    private final com.chamasmart.backend.repository.ContributionRepository contributionRepository;
    private final com.chamasmart.backend.repository.WelfareClaimRepository welfareClaimRepository;
    private final com.chamasmart.backend.service.MembershipService membershipService;
    /** GET /users/profile Ã¢â‚¬â€ returns the currently authenticated user's profile */
    @GetMapping("/users/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProfile(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get profile for user ID: {}", currentUser.getUserId());
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(ApiResponse.success(buildUserMap(user), "Profile retrieved successfully"));
    }
    /** PUT /users/profile Ã¢â‚¬â€ update name and phone */
    @PutMapping("/users/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateProfile(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody Map<String, String> body) {
        log.info("REST request to update profile for user ID: {}", currentUser.getUserId());
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        for (String key : new String[]{"firstName", "first_name", "lastName", "last_name"}) {
            if (body.get(key) != null && body.get(key).length() > 100) throw new IllegalArgumentException("Names must be 100 characters or fewer");
        }
        String phoneIn = body.containsKey("phoneNumber") ? body.get("phoneNumber") : body.get("phone_number");
        if (phoneIn != null && !phoneIn.isBlank() && !phoneIn.trim().matches("^\\+?[0-9 ]{9,15}$")) {
            throw new IllegalArgumentException("Enter a valid phone number");
        }
        String fn = body.containsKey("firstName") ? body.get("firstName") : body.get("first_name");
        if (fn != null && !fn.isBlank()) user.setFirstName(fn);
        String ln = body.containsKey("lastName") ? body.get("lastName") : body.get("last_name");
        if (ln != null && !ln.isBlank()) user.setLastName(ln);
        String ph = body.containsKey("phoneNumber") ? body.get("phoneNumber") : body.get("phone_number");
        if (ph != null && !ph.isBlank()) user.setPhoneNumber(ph);
        String natId = body.containsKey("nationalId") ? body.get("nationalId") : body.get("national_id");
        if (natId != null && !natId.isBlank()) user.setNationalId(natId);
        String ppu = body.containsKey("profilePictureUrl") ? body.get("profilePictureUrl") : body.get("profile_picture_url");
        if (ppu != null && !ppu.isBlank()) user.setProfilePictureUrl(ppu.startsWith("/") ? ppu : com.chamasmart.backend.util.SafeUrl.https(ppu, "profile picture"));
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.success(buildUserMap(user), "Profile updated successfully"));
    }
    /** A copy of everything the platform holds about the signed-in person, as a download. */
    @GetMapping("/users/me/export")
    public ResponseEntity<ApiResponse<Map<String, Object>>> exportMyData(@AuthenticationPrincipal CustomUserDetails currentUser) {
        User user = userRepository.findById(currentUser.getUserId()).orElseThrow(() -> new RuntimeException("User not found"));
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("exported_at", java.time.ZonedDateTime.now());
        Map<String, Object> profile = buildUserMap(user);
        profile.put("terms_accepted_at", user.getTermsAcceptedAt());
        out.put("profile", profile);
        out.put("memberships", chamaMemberRepository.findActiveMembershipsByUserId(user.getUserId()).stream().map(m -> {
            Map<String, Object> r = new java.util.LinkedHashMap<>();
            r.put("chama", m.getChama().getChamaName()); r.put("role", m.getRole()); r.put("joined", m.getJoinDate()); r.put("total_contributions", m.getTotalContributions());
            return r;
        }).toList());
        out.put("contributions", contributionRepository.findByUserUserIdAndIsDeletedFalse(user.getUserId()).stream().map(com.chamasmart.backend.dto.ContributionSummaryDto::fromEntity).toList());
        out.put("loans", loanRepository.findByBorrowerUserId(user.getUserId()).stream().map(l -> {
            Map<String, Object> r = new java.util.LinkedHashMap<>();
            r.put("loan_id", l.getLoanId()); r.put("chama", l.getChama().getChamaName()); r.put("principal", l.getLoanAmount());
            r.put("total_repayable", l.getTotalRepayable()); r.put("amount_paid", l.getAmountPaid()); r.put("status", l.getStatus());
            return r;
        }).toList());
        out.put("welfare_claims", welfareClaimRepository.findByMemberUserId(user.getUserId()).stream().map(c -> {
            Map<String, Object> r = new java.util.LinkedHashMap<>();
            r.put("claim_id", c.getClaimId()); r.put("amount", c.getClaimAmount()); r.put("status", c.getStatus()); r.put("description", c.getDescription());
            return r;
        }).toList());
        audit.record(user.getUserId(), "DATA_EXPORTED", "USER", user.getUserId(), null, null);
        return ResponseEntity.ok(ApiResponse.success(out, "Your data"));
    }
    /** GET /users/search */
    @GetMapping("/users/search")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> searchUsers(
            @RequestParam String query) {
        log.info("REST request to search users with query: {}", query);
        // Exact email or phone only: this must not become a way to browse every user.
        String q = query == null ? "" : query.trim();
        List<Map<String, Object>> results = new java.util.ArrayList<>();
        if (q.length() >= 7) {
            java.util.Optional<User> found = q.contains("@")
                    ? userRepository.findByEmail(q.toLowerCase())
                    : userRepository.findByPhoneNumber(q);
            found.ifPresent(u -> results.add(buildMaskedUserMap(u)));
        }
        return ResponseEntity.ok(ApiResponse.success(results, "Search results"));
    }
    @DeleteMapping("/users/account")
    public ResponseEntity<ApiResponse<Void>> deleteAccount(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to delete account for user ID: {}", currentUser.getUserId());
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        boolean openLoan = loanRepository.findByBorrowerUserId(user.getUserId()).stream()
                .anyMatch(l -> java.util.List.of("PENDING", "APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED").contains(String.valueOf(l.getStatus())));
        if (openLoan) {
            return ResponseEntity.status(409).body(ApiResponse.error("You still have a loan that isn't settled, so the account can't be closed yet"));
        }
        boolean chairs = chamaMemberRepository.findActiveMembershipsByUserId(user.getUserId()).stream()
                .anyMatch(m -> "CHAIRPERSON".equalsIgnoreCase(m.getRole()) && Boolean.TRUE.equals(m.getChama().getIsActive()));
        if (chairs) {
            return ResponseEntity.status(409).body(ApiResponse.error("You are the chairperson of an active chama. Retire it first so the group isn't left without one"));
        }
        // Savings still held for the member must be refunded first, through the exit process.
        var memberships = chamaMemberRepository.findActiveMembershipsByUserId(user.getUserId());
        for (var m : memberships) {
            if (membershipService.ownsSavings(m.getChama().getChamaId(), user.getUserId())) {
                return ResponseEntity.status(409).body(ApiResponse.error("You still have savings in " + m.getChama().getChamaName()
                        + ". Leave that chama first so your savings are refunded, then close your account."));
            }
        }
        for (var m : memberships) {
            m.setIsActive(false);
            m.setStatus("INACTIVE");
            chamaMemberRepository.save(m);
            membershipService.syncMemberCount(m.getChama());
        }
        // Personal details are erased. Money records stay, because the chamas need them, but they no longer carry the person's identity.
        Long id = user.getUserId();
        user.setIsActive(false);
        user.setFirstName("Former");
        user.setLastName("member");
        user.setEmail("deleted-" + id + "@deleted.invalid");
        user.setPhoneNumber(null);
        user.setNationalId(null);
        user.setProfilePictureUrl(null);
        user.setPasswordHash(passwordEncoder.encode(java.util.UUID.randomUUID() + "-" + java.util.UUID.randomUUID()));
        userRepository.save(user);
        refreshTokens.signOutEverywhere(user.getUserId());
        audit.record(id, "ACCOUNT_CLOSED", "USER", id, null, "Personal details erased");
        return ResponseEntity.ok(ApiResponse.success(null, "Account deleted successfully"));
    }
    @PostMapping("/users/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody Map<String, String> body) {
        log.info("REST request to change password for user ID: {}", currentUser.getUserId());
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        if (currentPassword == null || newPassword == null || currentPassword.isBlank() || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Passwords cannot be blank"));
        }
        if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Your new password must be at least 8 characters"));
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            return ResponseEntity.status(400).body(ApiResponse.error("Current password is incorrect"));
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        refreshTokens.signOutEverywhere(user.getUserId()); // a changed password ends every other session
        audit.record(user.getUserId(), "PASSWORD_CHANGED", "USER", user.getUserId(), null, null);
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed. Please sign in again."));
    }
    @PostMapping("/users/profile-picture")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadProfilePicture(@AuthenticationPrincipal CustomUserDetails currentUser, @RequestParam("file") MultipartFile file) throws IOException {
        log.info("REST request to upload profile picture for user ID: {}", currentUser.getUserId());
        String storedPath = profilePictureService.storeProfilePicture(currentUser.getUserId(), file);
        // Update user's profile picture URL
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setProfilePictureUrl(storedPath);
        userRepository.save(user);
        Map<String, String> response = new HashMap<>();
        response.put("url", storedPath);
        return ResponseEntity.ok(ApiResponse.success(response, "Profile picture uploaded successfully"));
    }
    private Map<String, Object> buildUserMap(User u) {
        Map<String, Object> m = new HashMap<>();
        m.put("user_id", u.getUserId());
        m.put("first_name", u.getFirstName());
        m.put("last_name", u.getLastName());
        m.put("email", u.getEmail());
        m.put("phone_number", u.getPhoneNumber());
        m.put("national_id", u.getNationalId());
        m.put("profile_picture_url", u.getProfilePictureUrl());
        m.put("role", u.getRole());
        m.put("is_active", u.getIsActive());
        m.put("email_verified", u.getEmailVerified());
        m.put("auth_method", u.getAuthMethod());
        m.put("trust_score", u.getTrustScore());
        m.put("created_at", u.getCreatedAt());
        return m;
    }
    private Map<String, Object> buildMaskedUserMap(User u) {
        Map<String, Object> m = buildUserMap(u);
        m.put("phone_number", maskString((String) m.get("phone_number"), 4, 2));
        m.put("email", maskEmail((String) m.get("email")));
        m.put("national_id", maskString((String) m.get("national_id"), 2, 2));
        return m;
    }
    private String maskString(String str, int startVisible, int endVisible) {
        if (str == null || str.length() <= (startVisible + endVisible)) return str;
        StringBuilder masked = new StringBuilder();
        masked.append(str.substring(0, startVisible));
        masked.append("***");
        masked.append(str.substring(str.length() - endVisible));
        return masked.toString();
    }
    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return email;
        String[] parts = email.split("@");
        if (parts[0].length() <= 2) {
            return parts[0] + "***@" + parts[1];
        }
        return parts[0].substring(0, 2) + "***@" + parts[1];
    }
}

