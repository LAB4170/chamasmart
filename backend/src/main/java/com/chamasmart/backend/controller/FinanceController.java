package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.AdminGuard;
import com.chamasmart.backend.service.FinanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static com.chamasmart.backend.service.Permission.*;

/** The finance desk of the admin console. */
@RestController
@RequestMapping("/admin/finance")
@RequiredArgsConstructor
public class FinanceController {
    private final AdminGuard guard;
    private final FinanceService finance;

    private static <T> ResponseEntity<ApiResponse<T>> ok(T d, String m) { return ResponseEntity.ok(ApiResponse.success(d, m)); }
    private static Long id(Map<String, Object> b, String k) { Object v = b.get(k); if (v == null || v.toString().isBlank()) throw new IllegalArgumentException("Missing " + k.replace('_', ' ')); return Long.valueOf(v.toString()); }
    private static String str(Map<String, Object> b, String k) { return b.get(k) == null ? null : b.get(k).toString(); }
    private static LocalDate d(String s, LocalDate dflt) { try { return s == null || s.isBlank() ? dflt : LocalDate.parse(s); } catch (Exception e) { throw new IllegalArgumentException("Dates look like 2026-10-31"); } }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, FINANCE_VIEW, "FINANCE_OVERVIEW"); return ok(finance.overview(), "Finance overview"); }

    @GetMapping("/subscriptions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> subs(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, FINANCE_VIEW, "SUBSCRIPTIONS"); return ok(finance.subscriptions(), "Plans"); }

    @GetMapping("/invoices")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> invoices(@RequestParam(required = false) String from, @RequestParam(required = false) String to, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me, FINANCE_VIEW, "INVOICES");
        LocalDate t = d(to, LocalDate.now());
        return ok(finance.invoices(d(from, t.withDayOfMonth(1)), t), "Invoices");
    }

    @GetMapping("/requests")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> requests(@RequestParam(required = false) String status, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, FINANCE_VIEW); return ok(finance.requests(status), "Requests"); }

    @PostMapping("/requests/assign")
    public ResponseEntity<ApiResponse<Map<String, Object>>> assign(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, FINANCE_MANAGE);
        return ok(finance.proposeAssign(a.userId(), id(b, "event_id"), id(b, "chama_id"), id(b, "user_id"), str(b, "reason")), "Sent for approval");
    }

    @PostMapping("/requests/return")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ret(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, FINANCE_MANAGE);
        return ok(finance.proposeReturn(a.userId(), id(b, "event_id"), str(b, "reason")), "Sent for approval");
    }

    @PostMapping("/requests/refund")
    public ResponseEntity<ApiResponse<Map<String, Object>>> refund(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, FINANCE_MANAGE);
        BigDecimal amt;
        try { amt = new BigDecimal(String.valueOf(b.get("amount"))); } catch (Exception e) { throw new IllegalArgumentException("Enter the amount to refund"); }
        return ok(finance.proposeRefund(a.userId(), id(b, "invoice_id"), amt, str(b, "reason")), "Sent for approval");
    }

    @PostMapping("/requests/{rid}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long rid, @AuthenticationPrincipal CustomUserDetails me) { return ok(finance.approve(guard.require(me, FINANCE_APPROVE).userId(), rid), "Approved"); }

    @PostMapping("/requests/{rid}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long rid, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { return ok(finance.reject(guard.require(me, FINANCE_APPROVE).userId(), rid, str(b, "note")), "Rejected"); }

    @PostMapping("/requests/{rid}/cancel")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancel(@PathVariable Long rid, @AuthenticationPrincipal CustomUserDetails me) { return ok(finance.cancel(guard.require(me, FINANCE_MANAGE).userId(), rid), "Withdrawn"); }

    @PostMapping("/requests/{rid}/complete")
    public ResponseEntity<ApiResponse<Map<String, Object>>> complete(@PathVariable Long rid, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { return ok(finance.complete(guard.require(me, FINANCE_MANAGE).userId(), rid, str(b, "external_ref")), "Recorded"); }

    @GetMapping("/vat-export")
    public ResponseEntity<byte[]> vat(@RequestParam(required = false) String from, @RequestParam(required = false) String to, @AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, FINANCE_VIEW);
        LocalDate t = d(to, LocalDate.now()), f = d(from, t.withDayOfMonth(1));
        guard.log(a.userId(), "FIN_VAT_EXPORT", null, f + " to " + t);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"chamasmart-vat-" + f + "-to-" + t + ".csv\"")
                .header("X-Content-Type-Options", "nosniff").header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8")).body(finance.vatCsv(f, t).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
