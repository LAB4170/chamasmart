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
@RequestMapping("/sessions")
@RequiredArgsConstructor
@Slf4j
public class SessionController {
    private static <T> ResponseEntity<ApiResponse<T>> notAvailable() {
        return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_IMPLEMENTED).body(ApiResponse.error("Live meeting sessions are not available yet"));
    }
    @PostMapping("/{chamaId}/{meetingId}/open")
    public ResponseEntity<ApiResponse<Void>> openSession(@PathVariable Long chamaId, @PathVariable Long meetingId, @RequestBody Map<String, Object> payload) { return notAvailable(); }
    @GetMapping("/{chamaId}/{meetingId}/data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSessionData(@PathVariable Long chamaId, @PathVariable Long meetingId) { return notAvailable(); }
    @PostMapping("/{chamaId}/{meetingId}/close")
    public ResponseEntity<ApiResponse<Void>> closeSession(@PathVariable Long chamaId, @PathVariable Long meetingId, @RequestBody Map<String, Object> payload) { return notAvailable(); }
    @PostMapping("/{chamaId}/{meetingId}/penalties")
    public ResponseEntity<ApiResponse<Void>> addPenalty(@PathVariable Long chamaId, @PathVariable Long meetingId, @RequestBody Map<String, Object> penaltyData) { return notAvailable(); }
    @GetMapping("/{chamaId}/{meetingId}/penalties")
    public ResponseEntity<ApiResponse<List<Object>>> getPenalties(@PathVariable Long chamaId, @PathVariable Long meetingId) { return notAvailable(); }
}
