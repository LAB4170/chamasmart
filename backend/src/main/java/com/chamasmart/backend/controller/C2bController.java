package com.chamasmart.backend.controller;

import com.chamasmart.backend.service.C2bService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Daraja C2B validation and confirmation. Safaricom does not sign these calls, so the registered URLs carry a secret segment.
 * Confirmation always answers "accepted" once the call is authenticated, because Safaricom retries otherwise; problems are parked, not bounced.
 */
@RestController
@RequestMapping("/payments/mpesa/c2b")
@RequiredArgsConstructor
@Slf4j
public class C2bController {
    private final C2bService c2b;
    @Value("${app.mpesa.c2b-secret:}") private String secret;
    @Value("${app.mpesa.env:sandbox}") private String env;

    private boolean authorised(String token) {
        if (secret == null || secret.isBlank()) return !"production".equalsIgnoreCase(env);
        return token != null && MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), secret.getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/{token}/validation")
    public ResponseEntity<Map<String, String>> validation(@PathVariable String token, @RequestBody Map<String, Object> body) {
        if (!authorised(token)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        Map<String, String> r = new LinkedHashMap<>();
        boolean ok = c2b.accepts(body);
        r.put("ResultCode", ok ? "0" : "C2B00012");
        r.put("ResultDesc", ok ? "Accepted" : "Rejected");
        return ResponseEntity.ok(r);
    }

    @PostMapping("/{token}/confirmation")
    public ResponseEntity<Map<String, String>> confirmation(@PathVariable String token, @RequestBody Map<String, Object> body) {
        if (!authorised(token)) { log.warn("SECURITY: C2B confirmation with a bad token refused"); return ResponseEntity.status(HttpStatus.FORBIDDEN).build(); }
        c2b.confirm(body);
        Map<String, String> r = new LinkedHashMap<>();
        r.put("ResultCode", "0");
        r.put("ResultDesc", "Accepted");
        return ResponseEntity.ok(r);
    }
}
