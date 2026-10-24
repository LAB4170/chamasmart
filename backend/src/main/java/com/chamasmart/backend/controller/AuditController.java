package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.FinancialAuditLog;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.repository.FinancialAuditLogRepository;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.MembershipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/** Financial audit trail. Officials read their chama's trail; everyone can read their own. */
@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditController {
    private static final ZoneId NAIROBI = ZoneId.of("Africa/Nairobi");
    private final FinancialAuditLogRepository auditRepo;
    private final MembershipService membershipService;
    private final com.chamasmart.backend.service.AuditTrailService trail;

    /** Platform administrators only: checks that no old audit entry has been changed or removed. */
    @GetMapping("/integrity")
    public ResponseEntity<ApiResponse<Map<String, Object>>> integrity(@AuthenticationPrincipal CustomUserDetails me) {
        boolean admin = me.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!admin) throw new AccessDeniedException("Only platform administrators can run this check");
        return ResponseEntity.ok(ApiResponse.success(trail.verify(), "Audit trail checked"));
    }

    private static Map<String, Object> row(FinancialAuditLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("audit_id", l.getAuditId());
        m.put("action", l.getTransactionType());
        m.put("entity_type", l.getTransactionType());
        m.put("user_name", l.getUser() == null ? null : l.getUser().getFirstName() + " " + l.getUser().getLastName());
        m.put("user_email", l.getUser() == null ? null : l.getUser().getEmail());
        m.put("amount", l.getAmount());
        m.put("details", l.getDescription());
        m.put("reference_id", l.getReferenceId());
        m.put("created_at", l.getCreatedAt());
        return m;
    }

    private List<FinancialAuditLog> filtered(Long chamaId, Map<String, String> p) {
        String action = p.getOrDefault("action", "").trim();
        String who = p.getOrDefault("user", "").trim().toLowerCase();
        LocalDate from = p.getOrDefault("startDate", "").isBlank() ? null : LocalDate.parse(p.get("startDate"));
        LocalDate to = p.getOrDefault("endDate", "").isBlank() ? null : LocalDate.parse(p.get("endDate"));
        return auditRepo.findByChamaChamaIdOrderByCreatedAtDesc(chamaId).stream()
                .filter(l -> action.isEmpty() || action.equalsIgnoreCase(l.getTransactionType()))
                .filter(l -> who.isEmpty() || (l.getUser() != null
                        && ((l.getUser().getFirstName() + " " + l.getUser().getLastName()).toLowerCase().contains(who)
                        || String.valueOf(l.getUser().getEmail()).toLowerCase().contains(who))))
                .filter(l -> {
                    if (l.getCreatedAt() == null) return true;
                    LocalDate d = l.getCreatedAt().withZoneSameInstant(NAIROBI).toLocalDate();
                    return (from == null || !d.isBefore(from)) && (to == null || !d.isAfter(to));
                })
                .collect(Collectors.toList());
    }

    @GetMapping("/chamas/{chamaId}")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> chamaLogs(@PathVariable Long chamaId, @RequestParam Map<String, String> params,
                                                                          @AuthenticationPrincipal CustomUserDetails me) {
        membershipService.activeOfficial(chamaId, me.getUserId());
        return ResponseEntity.ok(ApiResponse.success(filtered(chamaId, params).stream().map(AuditController::row).collect(Collectors.toList()), "Audit logs retrieved"));
    }

    @GetMapping("/chamas/{chamaId}/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> chamaSummary(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        membershipService.activeOfficial(chamaId, me.getUserId());
        List<FinancialAuditLog> all = auditRepo.findByChamaChamaIdOrderByCreatedAtDesc(chamaId);
        Map<String, Long> byAction = all.stream().collect(Collectors.groupingBy(l -> String.valueOf(l.getTransactionType()), TreeMap::new, Collectors.counting()));
        BigDecimal total = all.stream().map(l -> l.getAmount() == null ? BigDecimal.ZERO : l.getAmount()).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total_events", all.size());
        out.put("total_amount", total);
        out.put("by_action", byAction);
        return ResponseEntity.ok(ApiResponse.success(out, "Audit summary retrieved"));
    }

    @GetMapping("/chamas/{chamaId}/export")
    public ResponseEntity<byte[]> export(@PathVariable Long chamaId, @RequestParam Map<String, String> params, @AuthenticationPrincipal CustomUserDetails me) {
        membershipService.activeOfficial(chamaId, me.getUserId());
        StringBuilder sb = new StringBuilder("Date,Action,Member,Amount,Details\n");
        for (FinancialAuditLog l : filtered(chamaId, params)) {
            Map<String, Object> r = row(l);
            sb.append(csv(l.getCreatedAt())).append(',').append(csv(r.get("action"))).append(',').append(csv(r.get("user_name"))).append(',')
              .append(csv(r.get("amount"))).append(',').append(csv(r.get("details"))).append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=audit-" + chamaId + ".csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    /** Guards against spreadsheet formula injection as well as quoting. */
    private static String csv(Object v) {
        String s = v == null ? "" : v.toString();
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        return '"' + s.replace("\"", "\"\"") + '"';
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> userLogs(@PathVariable Long userId, @AuthenticationPrincipal CustomUserDetails me) {
        if (!me.getUserId().equals(userId)) throw new AccessDeniedException("You can only view your own activity");
        List<Map<String, Object>> rows = auditRepo.findAll().stream()
                .filter(l -> l.getUser() != null && userId.equals(l.getUser().getUserId()))
                .sorted(Comparator.comparing(FinancialAuditLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(AuditController::row).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(rows, "Your activity retrieved"));
    }

    @GetMapping("/security")
    public ResponseEntity<ApiResponse<Void>> security() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error("Security logs are not available yet"));
    }
}
