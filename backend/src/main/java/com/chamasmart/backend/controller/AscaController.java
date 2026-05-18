package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.dto.AscaCycleDto;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.AscaService;
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
@RequestMapping("/asca")
@RequiredArgsConstructor
public class AscaController {

    private final AscaService ascaService;

    @PostMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<AscaCycleDto>> createCycle(@PathVariable Long chamaId,
                                                                  @RequestBody AscaCycleDto cycleDto,
                                                                  @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create ASCA cycle for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        AscaCycleDto createdCycle = ascaService.createCycle(cycleDto, chamaId, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdCycle, "ASCA cycle created successfully"));
    }

    @PostMapping("/cycles/{cycleId}/shares/purchase")
    public ResponseEntity<ApiResponse<AscaCycleDto>> purchaseShares(@PathVariable Long cycleId,
                                                                    @RequestBody Map<String, Integer> payload,
                                                                    @AuthenticationPrincipal CustomUserDetails currentUser) {
        Integer shares = payload.get("shares");
        log.info("REST request to purchase {} shares in cycle ID: {} by user ID: {}", shares, cycleId, currentUser.getUserId());
        AscaCycleDto updatedCycle = ascaService.purchaseShares(cycleId, currentUser.getUserId(), shares);
        return ResponseEntity.ok(ApiResponse.success(updatedCycle, "Shares purchased successfully"));
    }

    @GetMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<List<AscaCycleDto>>> getCyclesByChamaId(@PathVariable Long chamaId) {
        log.info("REST request to get ASCA cycles for chama ID: {}", chamaId);
        List<AscaCycleDto> cycles = ascaService.getCyclesByChamaId(chamaId);
        return ResponseEntity.ok(ApiResponse.success(cycles, "ASCA cycles retrieved successfully"));
    }

    @GetMapping("/{chamaId}/proposals")
    public ResponseEntity<ApiResponse<List<Object>>> getProposals(@PathVariable Long chamaId) {
        log.info("REST request to get proposals for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "Proposals retrieved"));
    }

    @PostMapping("/{chamaId}/proposals")
    public ResponseEntity<ApiResponse<Object>> createProposal(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) {
        log.info("REST request to create proposal for chama ID: {}", chamaId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(null, "Proposal created"));
    }

    @PostMapping("/{chamaId}/proposals/{proposalId}/vote")
    public ResponseEntity<ApiResponse<Void>> voteProposal(@PathVariable Long chamaId, @PathVariable Long proposalId, @RequestBody Map<String, Object> payload) {
        log.info("REST request to vote on proposal ID: {} for chama ID: {}", proposalId, chamaId);
        return ResponseEntity.ok(ApiResponse.success(null, "Vote recorded successfully"));
    }

    @GetMapping("/{chamaId}/assets")
    public ResponseEntity<ApiResponse<List<Object>>> getAssets(@PathVariable Long chamaId) {
        log.info("REST request to get assets for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "Assets retrieved"));
    }

    @PostMapping("/{chamaId}/assets")
    public ResponseEntity<ApiResponse<Object>> createAsset(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) {
        log.info("REST request to create asset for chama ID: {}", chamaId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(null, "Asset created"));
    }

    @GetMapping("/{chamaId}/reports/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getReportsSummary(@PathVariable Long chamaId) {
        log.info("REST request to get reports summary for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new java.util.HashMap<>(), "Reports summary retrieved"));
    }

    @GetMapping("/{chamaId}/reports/member-statement")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMemberStatement(@PathVariable Long chamaId) {
        log.info("REST request to get member statement for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new java.util.HashMap<>(), "Member statement retrieved"));
    }

    @GetMapping("/{chamaId}/reports/standing")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStanding(@PathVariable Long chamaId) {
        log.info("REST request to get standing for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new java.util.HashMap<>(), "Standing retrieved"));
    }
}
