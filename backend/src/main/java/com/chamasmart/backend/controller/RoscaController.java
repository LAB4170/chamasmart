package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.dto.ContributionSummaryDto;
import com.chamasmart.backend.dto.RoscaCycleDto;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.RoscaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;
@RestController
@RequestMapping("/rosca")
@RequiredArgsConstructor
@Slf4j
public class RoscaController {
    private final RoscaService roscaService;
    @PostMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<RoscaCycleDto>> createCycle(@PathVariable Long chamaId,
                                                                  @RequestBody RoscaCycleDto cycleDto,
                                                                  @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create ROSCA cycle for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        RoscaCycleDto createdCycle = roscaService.createCycle(cycleDto, chamaId, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdCycle, "ROSCA cycle created successfully"));
    }
    @GetMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<List<RoscaCycleDto>>> getCyclesByChamaId(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get ROSCA cycles for chama ID: {}", chamaId);
        List<RoscaCycleDto> cycles = roscaService.getCyclesByChamaId(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(cycles, "ROSCA cycles retrieved successfully"));
    }
    @GetMapping("/cycles/{cycleId}")
    public ResponseEntity<ApiResponse<RoscaCycleDto>> getCycle(@PathVariable Long cycleId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(roscaService.getCycle(cycleId, currentUser.getUserId()), "Cycle retrieved"));
    }
    @GetMapping("/cycles/{cycleId}/roster")
    public ResponseEntity<ApiResponse<List<RoscaCycleDto.RosterPositionDto>>> getRoster(@PathVariable Long cycleId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(roscaService.getCycle(cycleId, currentUser.getUserId()).getRoster(), "Roster retrieved"));
    }
    private static ResponseEntity<ApiResponse<Void>> notAvailable(String what) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error(what + " is not available yet"));
    }
    @PostMapping("/cycles/{cycleId}/swap-request")
    public ResponseEntity<ApiResponse<Void>> requestSwap(@PathVariable Long cycleId, @RequestBody java.util.Map<String, Object> payload) {
        return notAvailable("Swapping positions");
    }
    @GetMapping("/swap-requests")
    public ResponseEntity<ApiResponse<List<Object>>> getSwapRequests() {
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "No swap requests"));
    }
    @PutMapping("/swap-requests/{requestId}/respond")
    public ResponseEntity<ApiResponse<Void>> respondToSwap(@PathVariable Long requestId, @RequestBody java.util.Map<String, String> payload) {
        return notAvailable("Swapping positions");
    }
    @PostMapping("/cycles/{cycleId}/payout")
    public ResponseEntity<ApiResponse<Void>> processPayout(
            @PathVariable Long cycleId, 
            @RequestBody(required = false) java.util.Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to process payout for cycle ID: {} by user ID: {}", cycleId, currentUser.getUserId());
        roscaService.processPayout(cycleId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Payout processed successfully"));
    }
    @PutMapping("/cycles/{cycleId}/activate")
    public ResponseEntity<ApiResponse<Void>> activateCycle(@PathVariable Long cycleId) {
        return notAvailable("Activating a cycle (cycles start active)");
    }
    @PutMapping("/cycles/{cycleId}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelCycle(@PathVariable Long cycleId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        roscaService.cancelCycle(cycleId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Cycle cancelled"));
    }
    @DeleteMapping("/cycles/{cycleId}")
    public ResponseEntity<ApiResponse<Void>> deleteCycle(@PathVariable Long cycleId) {
        return notAvailable("Deleting a cycle (cancel it instead)");
    }
    @PostMapping("/chamas/{chamaId}/cycles/{cycleId}/contributions")
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> makeContribution(
            @PathVariable Long chamaId, 
            @PathVariable Long cycleId, 
            @RequestBody java.util.Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to record ROSCA contribution for cycle ID: {} by user ID: {}", cycleId, currentUser.getUserId());
        Object amountObj = payload.get("amount");
        if (amountObj == null) {
            throw new RuntimeException("Contribution amount is required");
        }
        BigDecimal amount;
        if (amountObj instanceof Number) {
            amount = BigDecimal.valueOf(((Number) amountObj).doubleValue());
        } else {
            amount = new BigDecimal(amountObj.toString());
        }
        ContributionSummaryDto saved = roscaService.makeContribution(chamaId, cycleId, currentUser.getUserId(), amount);
        return ResponseEntity.ok(ApiResponse.success(saved, "Contribution submitted. It counts once an official verifies it."));
    }
    @GetMapping("/cycles/{cycleId}/contributions")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getContributions(@PathVariable Long cycleId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(roscaService.getCycleContributions(cycleId, currentUser.getUserId()), "Contributions retrieved"));
    }
    @GetMapping("/cycles/{cycleId}/members/{memberId}/statement")
    public ResponseEntity<ApiResponse<Void>> getMemberStatement(@PathVariable Long cycleId, @PathVariable Long memberId) {
        return notAvailable("Member statements");
    }
    @GetMapping("/chamas/{chamaId}/roster-preview")
    public ResponseEntity<ApiResponse<List<Object>>> getRosterPreview(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "Roster preview retrieved"));
    }
}

