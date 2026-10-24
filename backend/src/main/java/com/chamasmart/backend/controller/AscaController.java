package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.dto.AscaCycleDto;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.AscaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/asca")
@RequiredArgsConstructor
@Slf4j
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
        Integer target = payload.get("user_id");
        log.info("REST request to purchase {} shares in cycle ID: {} by user ID: {}", shares, cycleId, currentUser.getUserId());
        AscaCycleDto updatedCycle = ascaService.purchaseShares(cycleId, currentUser.getUserId(), target == null ? currentUser.getUserId() : target.longValue(), shares);
        return ResponseEntity.ok(ApiResponse.success(updatedCycle, "Share purchase recorded"));
    }
    @GetMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<List<AscaCycleDto>>> getCyclesByChamaId(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get ASCA cycles for chama ID: {}", chamaId);
        List<AscaCycleDto> cycles = ascaService.getCyclesByChamaId(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(cycles, "ASCA cycles retrieved successfully"));
    }
    private static <T> ResponseEntity<ApiResponse<T>> notAvailable(String what) {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error(what + " is not available yet"));
    }
    @GetMapping("/{chamaId}/proposals")
    public ResponseEntity<ApiResponse<List<Object>>> getProposals(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "No proposals"));
    }
    @PostMapping("/{chamaId}/proposals")
    public ResponseEntity<ApiResponse<Object>> createProposal(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) { return notAvailable("Proposals"); }
    @PostMapping("/{chamaId}/proposals/{proposalId}/vote")
    public ResponseEntity<ApiResponse<Void>> voteProposal(@PathVariable Long chamaId, @PathVariable Long proposalId, @RequestBody Map<String, Object> payload) { return notAvailable("Voting"); }
    @GetMapping("/{chamaId}/assets")
    public ResponseEntity<ApiResponse<List<Object>>> getAssets(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new java.util.ArrayList<>(), "No assets recorded"));
    }
    @PostMapping("/{chamaId}/assets")
    public ResponseEntity<ApiResponse<Object>> createAsset(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) { return notAvailable("Asset records"); }
    @GetMapping("/{chamaId}/reports/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getReportsSummary(@PathVariable Long chamaId) { return notAvailable("Reports"); }
    @GetMapping("/{chamaId}/reports/member-statement")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMemberStatement(@PathVariable Long chamaId) { return notAvailable("Member statements"); }
    @GetMapping("/{chamaId}/reports/standing")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStanding(@PathVariable Long chamaId) { return notAvailable("Standing reports"); }
}
