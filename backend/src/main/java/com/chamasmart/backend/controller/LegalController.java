package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.AdminGuard;
import com.chamasmart.backend.service.LegalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static com.chamasmart.backend.service.Permission.*;

/** The legal desk of the admin console. */
@RestController
@RequestMapping("/admin/legal")
@RequiredArgsConstructor
public class LegalController {
    private final AdminGuard guard;
    private final LegalService legal;

    private static <T> ResponseEntity<ApiResponse<T>> ok(T d, String m) { return ResponseEntity.ok(ApiResponse.success(d, m)); }
    private static String s(Map<String, Object> b, String k) { Object v = b.get(k); return v == null ? null : v.toString(); }
    private static Long l(Map<String, Object> b, String k) { String v = s(b, k); return v == null || v.isBlank() ? null : Long.valueOf(v.trim()); }

    @GetMapping("/cases/{caseId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> caseFile(@PathVariable Long caseId, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, CASE_VIEW, "CASE_FILE"); return ok(legal.caseFile(caseId), "Case file"); }

    @PostMapping("/cases/{caseId}/notes")
    public ResponseEntity<ApiResponse<Map<String, Object>>> note(@PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { return ok(legal.addNote(guard.require(me, CASE_OPEN).userId(), caseId, s(b, "body")), "Note added"); }

    @PostMapping("/cases/{caseId}/evidence")
    public ResponseEntity<ApiResponse<Map<String, Object>>> evidence(@PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, CASE_OPEN); guard.require(me, LEGAL_HOLD);
        return ok(legal.attachEvidence(a.userId(), caseId, l(b, "doc_id"), s(b, "note")), "Evidence attached");
    }

    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> orders(@RequestParam(required = false) String status, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, LEGAL_ORDERS, "ORDER_REGISTER"); return ok(legal.orders(status), "Orders"); }

    @GetMapping("/orders/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> order(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, LEGAL_ORDERS, "ORDER"); return ok(legal.order(id), "Order"); }

    @PostMapping("/orders")
    public ResponseEntity<ApiResponse<Map<String, Object>>> register(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { return ok(legal.registerOrder(guard.require(me, LEGAL_ORDERS).userId(), b), "Registered"); }

    @PostMapping("/orders/{id}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> move(@PathVariable Long id, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { return ok(legal.moveOrder(guard.require(me, LEGAL_ORDERS).userId(), id, s(b, "status"), s(b, "note")), "Updated"); }

    /** Downloads the evidence bundle. The disclosure is recorded first with recipient and basis. */
    @PostMapping("/cases/{caseId}/referral-pack")
    public ResponseEntity<byte[]> pack(@PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, CASE_REFERRAL);
        var p = legal.referralPack(a.userId(), a.has(DOCUMENT_VIEW), caseId, s(b, "recipient"), s(b, "basis"), l(b, "order_id"), Boolean.parseBoolean(String.valueOf(b.get("include_documents"))));
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + p.filename() + "\"")
                .header("X-Content-Type-Options", "nosniff").header(HttpHeaders.CACHE_CONTROL, "no-store").contentType(MediaType.parseMediaType("application/zip")).body(p.bytes());
    }
}
