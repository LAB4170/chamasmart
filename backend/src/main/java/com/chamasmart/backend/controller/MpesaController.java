package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.MpesaTransaction;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.MpesaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping({"/mpesa", "/payments/mpesa"})
@RequiredArgsConstructor
public class MpesaController {

    private final MpesaService mpesaService;

    @PostMapping({"/stkpush", "/stk-push"})
    public ResponseEntity<ApiResponse<Map<String, String>>> initiateStkPush(@RequestBody MpesaStkPushRequestDto requestDto,
                                                                            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to initiate STK Push by user ID: {}", currentUser.getUserId());
        MpesaTransaction transaction = mpesaService.initiateStkPush(requestDto, currentUser.getUserId());
        
        Map<String, String> responseData = new HashMap<>();
        responseData.put("checkout_request_id", transaction.getCheckoutRequestId());
        responseData.put("merchant_request_id", transaction.getMerchantRequestId());
        responseData.put("status", transaction.getStatus());

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(responseData, "M-Pesa STK Push initiated successfully. Please check your phone to enter PIN."));
    }

    // Public webhook endpoint for Safaricom Daraja servers
    @PostMapping("/callback")
    public ResponseEntity<Map<String, String>> mpesaCallback(@RequestBody MpesaCallbackDto callbackDto, jakarta.servlet.http.HttpServletRequest request) {
        String ipAddress = request.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isEmpty()) {
            ipAddress = request.getRemoteAddr();
        }
        
        log.info("REST request received Safaricom M-Pesa Daraja Callback from IP: {}", ipAddress);
        
        // Basic Safaricom IP Whitelist Validation (196.201.214.*, 196.201.213.*, 196.201.212.*)
        if (ipAddress != null && !ipAddress.startsWith("196.201.") && !ipAddress.startsWith("127.0.0.1") && !ipAddress.startsWith("localhost")) {
            log.warn("SECURITY ALERT: M-Pesa Callback blocked from unauthorized IP: {}", ipAddress);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        mpesaService.processCallback(callbackDto);

        Map<String, String> response = new HashMap<>();
        response.put("ResultCode", "0");
        response.put("ResultDesc", "Callback processed successfully");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/contributions/chamas/{chamaId}")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getContributionsByChamaId(@PathVariable Long chamaId) {
        log.info("REST request to get contributions for chama ID: {}", chamaId);
        List<ContributionSummaryDto> contributions = mpesaService.getContributionsByChamaId(chamaId);
        return ResponseEntity.ok(ApiResponse.success(contributions, "Contributions retrieved successfully"));
    }

    @GetMapping("/contributions/my")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getMyContributions(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get contributions for user ID: {}", currentUser.getUserId());
        List<ContributionSummaryDto> contributions = mpesaService.getMyContributions(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(contributions, "My contributions retrieved successfully"));
    }
}
