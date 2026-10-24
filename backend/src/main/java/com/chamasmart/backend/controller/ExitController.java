package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.ExitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Leaving a chama: preview, request, approve, pay out, cancel, and the closing statement. */
@RestController
@RequestMapping("/chamas/{chamaId}/exits")
@RequiredArgsConstructor
public class ExitController {
    private final ExitService exits;

    private static Map<String, Object> row(com.chamasmart.backend.domain.MemberExit e) {
        return Map.of("exit_id", e.getExitId(), "status", e.getStatus(), "kind", e.getKind(),
                "refund_amount", e.getRefundAmount() == null ? 0 : e.getRefundAmount());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(exits.list(chamaId, me.getUserId()), "Exit requests"));
    }

    @GetMapping("/preview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> preview(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(exits.preview(chamaId, me.getUserId()), "Exit preview"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> leave(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(row(exits.requestLeave(chamaId, me.getUserId())),
                "Your request is with the officials. You stay a member until your refund is paid."));
    }

    @PostMapping("/{exitId}/decision")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decide(@PathVariable Long chamaId, @PathVariable Long exitId,
                                                                   @RequestBody Map<String, String> body, @AuthenticationPrincipal CustomUserDetails me) {
        boolean approve = "APPROVED".equalsIgnoreCase(body.get("decision"));
        return ResponseEntity.ok(ApiResponse.success(row(exits.approve(chamaId, exitId, me.getUserId(), approve, body.get("note"))),
                approve ? "Approved. A different official now pays the refund." : "Declined"));
    }

    @PostMapping("/{exitId}/pay")
    public ResponseEntity<ApiResponse<Map<String, Object>>> pay(@PathVariable Long chamaId, @PathVariable Long exitId,
                                                                @RequestBody(required = false) Map<String, String> body, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(row(exits.pay(chamaId, exitId, me.getUserId(), body == null ? null : body.get("reference"))),
                "Refund recorded and the member has left the chama"));
    }

    @PostMapping("/{exitId}/cancel")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancel(@PathVariable Long chamaId, @PathVariable Long exitId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(row(exits.cancel(chamaId, exitId, me.getUserId())), "Exit cancelled"));
    }

    @GetMapping("/{exitId}/statement")
    public ResponseEntity<ApiResponse<Map<String, Object>>> statement(@PathVariable Long chamaId, @PathVariable Long exitId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(exits.statement(chamaId, exitId, me.getUserId()), "Closing statement"));
    }
}
