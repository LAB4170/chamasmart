package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.FineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/chamas/{chamaId}/fines")
@RequiredArgsConstructor
public class FineController {
    private final FineService fines;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> list(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(fines.list(chamaId, me.getUserId()), "Fines"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> issue(@PathVariable Long chamaId, @RequestBody Map<String, Object> body, @AuthenticationPrincipal CustomUserDetails me) {
        Object uid = body.get("user_id"), amt = body.get("amount"), reason = body.get("reason");
        if (uid == null || amt == null) throw new IllegalArgumentException("Choose a member and an amount");
        return ResponseEntity.ok(ApiResponse.success(fines.issue(chamaId, me.getUserId(), Long.valueOf(uid.toString()),
                new BigDecimal(amt.toString()), reason == null ? null : reason.toString()), "Fine issued"));
    }

    @PostMapping("/{fineId}/waive")
    public ResponseEntity<ApiResponse<Map<String, Object>>> waive(@PathVariable Long chamaId, @PathVariable Long fineId, @RequestBody Map<String, Object> body, @AuthenticationPrincipal CustomUserDetails me) {
        Object note = body.get("note");
        return ResponseEntity.ok(ApiResponse.success(fines.waive(chamaId, me.getUserId(), fineId, note == null ? null : note.toString()), "Fine waived"));
    }
}
