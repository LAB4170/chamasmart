package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/api-keys")
@RequiredArgsConstructor
@Slf4j
public class ApiKeyController {
    private static <T> ResponseEntity<ApiResponse<T>> notAvailable() {
        return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error("API keys are not available yet"));
    }
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> createApiKey(@RequestBody Map<String, Object> keyData) { return notAvailable(); }
    @GetMapping
    public ResponseEntity<ApiResponse<List<Object>>> listApiKeys() { return ResponseEntity.ok(ApiResponse.success(new ArrayList<>(), "No API keys")); }
    @PostMapping("/{keyId}/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeApiKey(@PathVariable Long keyId) { return notAvailable(); }
    @DeleteMapping("/{keyId}")
    public ResponseEntity<ApiResponse<Void>> deleteApiKey(@PathVariable Long keyId) { return notAvailable(); }
    @PostMapping("/{keyId}/rotate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rotateApiKey(@PathVariable Long keyId) { return notAvailable(); }
}
