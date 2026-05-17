package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.WelfareService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/welfare")
@RequiredArgsConstructor
public class WelfareController {

    private final WelfareService welfareService;

    @PostMapping("/chamas/{chamaId}/configs")
    public ResponseEntity<ApiResponse<WelfareConfigDto>> createConfig(@PathVariable Long chamaId,
                                                                      @RequestBody WelfareConfigDto configDto,
                                                                      @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create welfare config for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        WelfareConfigDto createdConfig = welfareService.createConfig(configDto, chamaId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdConfig, "Welfare configuration created successfully"));
    }

    @GetMapping("/chamas/{chamaId}/configs")
    public ResponseEntity<ApiResponse<List<WelfareConfigDto>>> getConfigsByChamaId(@PathVariable Long chamaId) {
        log.info("REST request to get welfare configs for chama ID: {}", chamaId);
        List<WelfareConfigDto> configs = welfareService.getConfigsByChamaId(chamaId);
        return ResponseEntity.ok(ApiResponse.success(configs, "Welfare configurations retrieved successfully"));
    }

    @PostMapping("/claims")
    public ResponseEntity<ApiResponse<WelfareClaimSummaryDto>> fileClaim(@RequestBody WelfareClaimRequestDto requestDto,
                                                                         @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to file welfare claim by user ID: {}", currentUser.getUserId());
        WelfareClaimSummaryDto filedClaim = welfareService.fileClaim(requestDto, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(filedClaim, "Welfare claim submitted successfully"));
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
    public ResponseEntity<ApiResponse<List<WelfareClaimSummaryDto>>> getClaimsByChamaId(@PathVariable Long chamaId) {
        log.info("REST request to get welfare claims for chama ID: {}", chamaId);
        List<WelfareClaimSummaryDto> claims = welfareService.getClaimsByChamaId(chamaId);
        return ResponseEntity.ok(ApiResponse.success(claims, "Welfare claims retrieved successfully"));
    }

    @GetMapping("/claims/my")
    public ResponseEntity<ApiResponse<List<WelfareClaimSummaryDto>>> getMyClaims(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get welfare claims for user ID: {}", currentUser.getUserId());
        List<WelfareClaimSummaryDto> claims = welfareService.getMyClaims(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(claims, "My welfare claims retrieved successfully"));
    }
}
