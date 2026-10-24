package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.CrossOrigin;
import com.chamasmart.backend.domain.MpesaTransaction;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.MpesaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping({"/mpesa", "/payments/mpesa"})
@RequiredArgsConstructor
@Slf4j
public class MpesaController {
    private final MpesaService mpesaService;

    @org.springframework.beans.factory.annotation.Value("${app.mpesa.callback-secret:}")
    private String callbackSecret;

    @org.springframework.beans.factory.annotation.Value("${app.mpesa.env:sandbox}")
    private String mpesaEnv;
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
    // Public webhook endpoint for Safaricom Daraja. Authenticated by a shared secret in the registered callback URL
    // (IP headers such as X-Forwarded-For can be forged by any client, so they are not trusted).
    @PostMapping("/callback")
    public ResponseEntity<Map<String, String>> mpesaCallback(@RequestBody MpesaCallbackDto callbackDto,
                                                             @RequestParam(value = "token", required = false) String token) {
        boolean secretConfigured = callbackSecret != null && !callbackSecret.isBlank();
        boolean authorised;
        if (secretConfigured) {
            authorised = token != null && java.security.MessageDigest.isEqual(
                    token.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    callbackSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } else {
            // No secret configured: tolerated only outside production (sandbox/local development).
            authorised = !"production".equalsIgnoreCase(mpesaEnv);
        }
        if (!authorised) {
            log.warn("SECURITY: M-Pesa callback rejected (missing or invalid token)");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        mpesaService.processCallback(callbackDto);
        Map<String, String> response = new HashMap<>();
        response.put("ResultCode", "0");
        response.put("ResultDesc", "Callback processed successfully");
        return ResponseEntity.ok(response);
    }
    @GetMapping("/transactions/{checkoutRequestId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTransactionStatus(@PathVariable String checkoutRequestId,
                                                                                 @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(mpesaService.getTransactionStatus(checkoutRequestId, currentUser.getUserId()), "Transaction status retrieved"));
    }
    @GetMapping("/contributions/chamas/{chamaId}")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getContributionsByChamaId(@PathVariable Long chamaId,
                                                                                                    @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get contributions for chama ID: {}", chamaId);
        List<ContributionSummaryDto> contributions = mpesaService.getContributionsByChamaId(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(contributions, "Contributions retrieved successfully"));
    }
    @GetMapping("/contributions/my")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getMyContributions(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get contributions for user ID: {}", currentUser.getUserId());
        List<ContributionSummaryDto> contributions = mpesaService.getMyContributions(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(contributions, "My contributions retrieved successfully"));
    }
}

