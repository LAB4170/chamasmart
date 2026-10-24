package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.WelfareService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/welfare")
@RequiredArgsConstructor
@Slf4j
public class WelfareController {
    private final WelfareService welfareService;
    private final com.chamasmart.backend.service.ContributionService contributionService;
    @PostMapping("/chamas/{chamaId}/configs")
    public ResponseEntity<ApiResponse<WelfareConfigDto>> createConfig(@PathVariable Long chamaId,
                                                                      @RequestBody WelfareConfigDto configDto,
                                                                      @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create welfare config for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        WelfareConfigDto createdConfig = welfareService.createConfig(configDto, chamaId, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdConfig, "Welfare configuration created successfully"));
    }
    @GetMapping("/chamas/{chamaId}/configs")
    public ResponseEntity<ApiResponse<List<WelfareConfigDto>>> getConfigsByChamaId(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get welfare configs for chama ID: {}", chamaId);
        List<WelfareConfigDto> configs = welfareService.getConfigsByChamaId(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(configs, "Welfare configurations retrieved successfully"));
    }
    /** A member reports a welfare payment; it reaches the welfare fund only after an official verifies it. */
    @PostMapping("/chamas/{chamaId}/contributions")
    public ResponseEntity<ApiResponse<com.chamasmart.backend.dto.ContributionSummaryDto>> makeContribution(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload,
                                                                                                            @AuthenticationPrincipal CustomUserDetails currentUser) {
        Object amt = payload.get("amount");
        if (amt == null) throw new IllegalArgumentException("Contribution amount is required");
        java.math.BigDecimal amount = new java.math.BigDecimal(amt.toString());
        Object ref = payload.get("reference");
        var saved = contributionService.submit(chamaId, currentUser.getUserId(), new com.chamasmart.backend.service.ContributionService.Entry(
                currentUser.getUserId(), amount, ref == null ? null : ref.toString(), "WELFARE", "Welfare contribution", null));
        return ResponseEntity.ok(ApiResponse.success(saved, "Contribution submitted. It counts once an official verifies it."));
    }
    private static <T> ResponseEntity<ApiResponse<T>> notAvailable(String what) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error(what + " is not available yet"));
    }
    @GetMapping("/{chamaId}/emergency-drives")
    public ResponseEntity<ApiResponse<List<Object>>> getEmergencyDrives(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "No emergency drives"));
    }
    @PostMapping("/{chamaId}/emergency-drives")
    public ResponseEntity<ApiResponse<Object>> createEmergencyDrive(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) {
        return notAvailable("Emergency drives");
    }
    @PostMapping("/emergency-drives/{driveId}/contribute")
    public ResponseEntity<ApiResponse<Void>> contributeToDrive(@PathVariable Long driveId, @RequestBody Map<String, Object> payload) {
        return notAvailable("Emergency drives");
    }
    @GetMapping("/{chamaId}/ledger")
    public ResponseEntity<ApiResponse<Object>> getLedger(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get welfare ledger for chama ID: {}", chamaId);
        Object ledger = welfareService.getLedger(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(ledger, "Welfare ledger retrieved"));
    }
    @PostMapping(value = "/claims")
    public ResponseEntity<ApiResponse<WelfareClaimSummaryDto>> fileClaim(@ModelAttribute WelfareClaimRequestDto requestDto,
                                                                         @RequestParam(value = "proof_document", required = false) org.springframework.web.multipart.MultipartFile proofDocument,
                                                                         @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to file welfare claim by user ID: {}", currentUser.getUserId());
        if (proofDocument != null && !proofDocument.isEmpty()) {
            // Document storage isn't connected yet, so the file is not kept. Say so rather than invent a link.
            log.info("Proof document '{}' received but not stored", proofDocument.getOriginalFilename());
        }
        WelfareClaimSummaryDto filedClaim = welfareService.fileClaim(requestDto, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(filedClaim, proofDocument != null && !proofDocument.isEmpty() ? "Claim submitted. Attached documents are not stored yet, so officials may ask you for proof." : "Welfare claim submitted successfully"));
    }
    @PostMapping("/claims/{claimId}/approve")
    public ResponseEntity<ApiResponse<WelfareClaimSummaryDto>> approveClaim(@PathVariable Long claimId,
                                                                            @RequestBody Map<String, String> payload,
                                                                            @AuthenticationPrincipal CustomUserDetails currentUser) {
        String decision = payload.get("decision"); // APPROVED or REJECTED
        String comments = payload.get("comments");
        log.info("REST request to approve claim ID: {} by user ID: {} with decision: {}", claimId, currentUser.getUserId(), decision);
        WelfareClaimSummaryDto updatedClaim = welfareService.approveClaim(claimId, currentUser.getUserId(), decision, comments);
        return ResponseEntity.ok(ApiResponse.success(updatedClaim, "Welfare claim approval processed successfully"));
    }
    @GetMapping("/chamas/{chamaId}/claims")
    public ResponseEntity<ApiResponse<List<WelfareClaimSummaryDto>>> getClaimsByChamaId(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get welfare claims for chama ID: {}", chamaId);
        List<WelfareClaimSummaryDto> claims = welfareService.getClaimsByChamaId(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(claims, "Welfare claims retrieved successfully"));
    }
    @GetMapping("/claims/my")
    public ResponseEntity<ApiResponse<List<WelfareClaimSummaryDto>>> getMyClaims(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get welfare claims for user ID: {}", currentUser.getUserId());
        List<WelfareClaimSummaryDto> claims = welfareService.getMyClaims(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(claims, "My welfare claims retrieved successfully"));
    }
}

