package com.chamasmart.backend.service;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class MpesaService {
    private final MpesaTransactionRepository mpesaTransactionRepository;
    private final ContributionRepository contributionRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;
    private final ApplicationContext applicationContext;

    @Value("${app.mpesa.env:sandbox}")
    private String env;

    @Value("${app.mpesa.consumer-key:cpQnnxLsrtEU7WQ94G5XwfBGG11yUckjQAnAJPQXM9JkHycV}")
    private String consumerKey;

    @Value("${app.mpesa.consumer-secret:YOUR_DARAJA_SANDBOX_CONSUMER_SECRET}")
    private String consumerSecret;

    @Value("${app.mpesa.shortcode:174379}")
    private String shortcode;

    @Value("${app.mpesa.passkey:bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919}")
    private String passkey;

    @Value("${app.mpesa.callback-url:https://chamasmart-xcym.onrender.com/api/v1/mpesa/callback}")
    private String callbackUrl;

    @Value("${app.mpesa.callback-secret:}")
    private String callbackSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    /** Callback URL registered with Daraja; carries the shared secret the callback endpoint verifies. */
    private String effectiveCallbackUrl() {
        if (callbackSecret == null || callbackSecret.isBlank()) {
            return callbackUrl;
        }
        return callbackUrl + (callbackUrl.contains("?") ? "&" : "?") + "token="
                + java.net.URLEncoder.encode(callbackSecret, java.nio.charset.StandardCharsets.UTF_8);
    }

    private String getAccessToken() {
        String baseUrl = "production".equalsIgnoreCase(env) ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
        String url = baseUrl + "/oauth/v1/generate?grant_type=client_credentials";

        String auth = consumerKey + ":" + consumerSecret;
        byte[] encodedAuth = java.util.Base64.getEncoder().encode(auth.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String authHeader = "Basic " + new String(encodedAuth);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", authHeader);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return (String) response.getBody().get("access_token");
            }
        } catch (Exception e) {
            log.error("Failed to get Daraja access token: {}", e.getMessage());
        }
        return null;
    }

    private String getPassword(String timestamp) {
        String str = shortcode + passkey + timestamp;
        return java.util.Base64.getEncoder().encodeToString(str.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Transactional
    public MpesaTransaction initiateStkPush(MpesaStkPushRequestDto requestDto, Long userId) {
        log.info("Initiating M-Pesa STK Push for user ID: {}, chama ID: {}, amount: {}", userId, requestDto.getChamaId(), requestDto.getAmount());
        BigDecimal requested = requestDto.getAmount();
        if (requested == null || requested.signum() <= 0 || requested.stripTrailingZeros().scale() > 0) {
            // M-Pesa charges whole shillings; accepting cents would charge less than we would record.
            throw new IllegalArgumentException("Amount must be a whole number of shillings greater than zero");
        }
        String phone = requestDto.getPhoneNumber() == null ? "" : requestDto.getPhoneNumber().trim();
        if (!phone.matches("^(\\+?254|0)[17]\\d{8}$")) {
            throw new IllegalArgumentException("Enter a valid Safaricom number, for example 0712345678");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Chama chama = chamaRepository.findById(requestDto.getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        if (!chamaMemberRepository.existsByChamaChamaIdAndUserUserIdAndIsActiveTrue(chama.getChamaId(), userId)) {
            throw new org.springframework.security.access.AccessDeniedException("You are not an active member of this chama");
        }
        // Mock payments are allowed only outside production. A placeholder secret in production must fail loudly.
        if (consumerSecret.contains("YOUR_DARAJA")) {
            if ("production".equalsIgnoreCase(env)) {
                throw new IllegalStateException("M-Pesa is not configured: set MPESA_CONSUMER_SECRET");
            }
            log.warn("Using MOCKED Daraja STK Push (non-production, placeholder consumer-secret).");
            String checkoutRequestId = "ws_CO_" + UUID.randomUUID().toString().substring(0, 15).replace("-", "");
            String merchantRequestId = "req_" + UUID.randomUUID().toString().substring(0, 10).replace("-", "");
            
            MpesaTransaction transaction = MpesaTransaction.builder()
                    .checkoutRequestId(checkoutRequestId)
                    .merchantRequestId(merchantRequestId)
                    .user(user)
                    .chama(chama)
                    .amount(requestDto.getAmount())
                    .phoneNumber(requestDto.getPhoneNumber())
                    .status("PENDING")
                    .build();
            MpesaTransaction savedTransaction = mpesaTransactionRepository.save(transaction);
            
            // Simulate callback after 4 seconds
            simulateCallbackAsync(checkoutRequestId, requestDto.getAmount(), 4000);
            
            return savedTransaction;
        }

        // Real Daraja Integration
        String token = getAccessToken();
        if (token == null) {
            throw new RuntimeException("Failed to authenticate with Safaricom Daraja");
        }

        String baseUrl = "production".equalsIgnoreCase(env) ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
        String url = baseUrl + "/mpesa/stkpush/v1/processrequest";

        String timestamp = new java.text.SimpleDateFormat("yyyyMMddHHmmss").format(new java.util.Date());
        String password = getPassword(timestamp);

        String formattedPhone = requestDto.getPhoneNumber().trim();
        if (formattedPhone.startsWith("0")) {
            formattedPhone = "254" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("+")) {
            formattedPhone = formattedPhone.substring(1);
        }

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("BusinessShortCode", Integer.parseInt(shortcode));
        body.put("Password", password);
        body.put("Timestamp", timestamp);
        body.put("TransactionType", "CustomerPayBillOnline");
        body.put("Amount", requestDto.getAmount().intValue());
        body.put("PartyA", Long.parseLong(formattedPhone));
        body.put("PartyB", Integer.parseInt(shortcode));
        body.put("PhoneNumber", Long.parseLong(formattedPhone));
        body.put("CallBackURL", effectiveCallbackUrl());
        body.put("AccountReference", "ChamaSmart");
        body.put("TransactionDesc", "Chama Contribution");

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
            Map<String, Object> responseBody = response.getBody();
            
            if (response.getStatusCode().is2xxSuccessful() && responseBody != null) {
                String responseCode = (String) responseBody.get("ResponseCode");
                if ("0".equals(responseCode)) {
                    String checkoutRequestId = (String) responseBody.get("CheckoutRequestID");
                    String merchantRequestId = (String) responseBody.get("MerchantRequestID");
                    
                    MpesaTransaction transaction = MpesaTransaction.builder()
                            .checkoutRequestId(checkoutRequestId)
                            .merchantRequestId(merchantRequestId)
                            .user(user)
                            .chama(chama)
                            .amount(requestDto.getAmount())
                            .phoneNumber(formattedPhone)
                            .status("PENDING")
                            .build();
                    MpesaTransaction savedTransaction = mpesaTransactionRepository.save(transaction);
                    log.info("Daraja STK Push initiated successfully. CheckoutRequestID: {}", checkoutRequestId);
                    
                    // If local testing, Daraja won't be able to hit the callback URL, so we simulate it.
                    if (callbackUrl.contains("localhost") || env.equalsIgnoreCase("local")) {
                        simulateCallbackAsync(checkoutRequestId, requestDto.getAmount(), 15000);
                    }
                    
                    return savedTransaction;
                } else {
                    throw new RuntimeException("Daraja error: " + responseBody.get("ResponseDescription"));
                }
            } else {
                throw new RuntimeException("Failed to initiate STK Push: Invalid response from Daraja");
            }
        } catch (Exception e) {
            log.error("STK Push error: {}", e.getMessage());
            throw new RuntimeException("Failed to initiate M-Pesa STK Push: " + e.getMessage());
        }
    }

    private void simulateCallbackAsync(String checkoutRequestId, BigDecimal amount, long delayMs) {
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(delayMs);
                MpesaCallbackDto.Item amountItem = new MpesaCallbackDto.Item();
                amountItem.setName("Amount");
                amountItem.setValue(amount.intValue());

                MpesaCallbackDto.Item receiptItem = new MpesaCallbackDto.Item();
                receiptItem.setName("MpesaReceiptNumber");
                receiptItem.setValue("R" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

                MpesaCallbackDto.CallbackMetadata metadata = new MpesaCallbackDto.CallbackMetadata();
                metadata.setItem(java.util.Arrays.asList(amountItem, receiptItem));

                MpesaCallbackDto.StkCallback stkCallback = new MpesaCallbackDto.StkCallback();
                stkCallback.setCheckoutRequestID(checkoutRequestId);
                stkCallback.setResultCode(0);
                stkCallback.setResultDesc("Success - Simulated");
                stkCallback.setCallbackMetadata(metadata);

                MpesaCallbackDto.Body body = new MpesaCallbackDto.Body();
                body.setStkCallback(stkCallback);

                MpesaCallbackDto callbackDto = new MpesaCallbackDto();
                callbackDto.setBody(body);

                log.info("Executing simulated callback for CheckoutRequestID: {}", checkoutRequestId);
                applicationContext.getBean(MpesaService.class).processCallback(callbackDto);
            } catch (Exception e) {
                log.error("Error in simulated callback: {}", e.getMessage());
            }
        });
    }
    @Transactional
    public void processCallback(MpesaCallbackDto callbackDto) {
        if (callbackDto.getBody() == null || callbackDto.getBody().getStkCallback() == null) {
            log.error("Invalid M-Pesa callback payload received");
            return;
        }
        MpesaCallbackDto.StkCallback stkCallback = callbackDto.getBody().getStkCallback();
        String checkoutRequestId = stkCallback.getCheckoutRequestID();
        Integer resultCode = stkCallback.getResultCode();
        String resultDesc = stkCallback.getResultDesc();
        log.info("Processing M-Pesa Callback for CheckoutRequestID: {}, ResultCode: {}", checkoutRequestId, resultCode);
        if (checkoutRequestId == null || resultCode == null) {
            log.error("M-Pesa callback missing CheckoutRequestID or ResultCode; ignored");
            return;
        }
        MpesaTransaction transaction = mpesaTransactionRepository.findByCheckoutRequestIdForUpdate(checkoutRequestId).orElse(null);
        if (transaction == null) {
            log.warn("M-Pesa callback for unknown CheckoutRequestID {}; ignored", checkoutRequestId);
            return;
        }
        // Idempotency: Daraja can retry callbacks. Only a PENDING payment may be settled, exactly once.
        if (!"PENDING".equals(transaction.getStatus())) {
            log.info("Duplicate M-Pesa callback for {} (already {}); ignored", checkoutRequestId, transaction.getStatus());
            return;
        }
        transaction.setResultCode(resultCode);
        transaction.setResultDesc(resultDesc);
        if (resultCode == 0) {
            // Extract receipt and paid amount from metadata; never invent a receipt.
            String mpesaReceipt = null;
            BigDecimal paidAmount = null;
            if (stkCallback.getCallbackMetadata() != null && stkCallback.getCallbackMetadata().getItem() != null) {
                for (MpesaCallbackDto.Item item : stkCallback.getCallbackMetadata().getItem()) {
                    if (item.getValue() == null) continue;
                    if ("MpesaReceiptNumber".equalsIgnoreCase(item.getName())) {
                        mpesaReceipt = item.getValue().toString();
                    } else if ("Amount".equalsIgnoreCase(item.getName())) {
                        try { paidAmount = new BigDecimal(item.getValue().toString()); } catch (NumberFormatException ignored) { }
                    }
                }
            }
            if (mpesaReceipt == null || mpesaReceipt.isBlank()
                    || (paidAmount != null && paidAmount.compareTo(transaction.getAmount()) != 0)) {
                log.error("M-Pesa callback for {} rejected: missing receipt or amount mismatch (expected {}, got {})",
                        checkoutRequestId, transaction.getAmount(), paidAmount);
                transaction.setStatus("FAILED");
                transaction.setResultDesc("Callback rejected: missing receipt or amount mismatch");
                mpesaTransactionRepository.save(transaction);
                return;
            }
            if (contributionRepository.existsByReference(mpesaReceipt)) {
                log.warn("M-Pesa receipt {} already recorded; ignored", mpesaReceipt);
                transaction.setStatus("FAILED");
                transaction.setResultDesc("Duplicate receipt");
                mpesaTransactionRepository.save(transaction);
                return;
            }
            transaction.setStatus("COMPLETED");
            transaction.setMpesaReceipt(mpesaReceipt);
            // Create Contribution record
            Contribution contribution = Contribution.builder()
                    .chama(transaction.getChama())
                    .user(transaction.getUser())
                    .amount(transaction.getAmount())
                    .reference(mpesaReceipt)
                    .status("COMPLETED")
                    .contributionType("REGULAR")
                    .isDeleted(false)
                    .build();
            Contribution savedContribution = contributionRepository.save(contribution);
            transaction.setContribution(savedContribution);
            // Update ChamaMember total contributions
            chamaMemberRepository.findByChamaChamaIdAndUserUserId(transaction.getChama().getChamaId(), transaction.getUser().getUserId())
                    .ifPresent(member -> {
                        member.setTotalContributions(member.getTotalContributions().add(transaction.getAmount()));
                        member.setLastContributionDate(ZonedDateTime.now());
                        chamaMemberRepository.save(member);
                    });
            // Update Chama current fund
            Chama chama = transaction.getChama();
            chama.setCurrentFund(chama.getCurrentFund().add(transaction.getAmount()));
            chamaRepository.save(chama);
            // Write immutable Financial Audit Log
            FinancialAuditLog auditLog = FinancialAuditLog.builder()
                    .user(transaction.getUser())
                    .transactionType("MPESA_CONTRIBUTION")
                    .amount(transaction.getAmount())
                    .chama(transaction.getChama())
                    .referenceId(savedContribution.getContributionId())
                    .description("Successful M-Pesa STK Push contribution. Receipt: " + mpesaReceipt)
                    .ipAddress("127.0.0.1") // Callback IP
                    .userAgent("Safaricom-Daraja-Webhook")
                    .build();
            auditLogRepository.save(auditLog);
            log.info("Successfully processed M-Pesa contribution for Chama ID: {}, Amount: {}", chama.getChamaId(), transaction.getAmount());
        } else {
            // Transaction Failed / Cancelled by user
            transaction.setStatus("FAILED");
            log.warn("M-Pesa transaction failed. ResultDesc: {}", resultDesc);
        }
        mpesaTransactionRepository.save(transaction);
    }
    /** Status of one STK push, visible only to the member who started it. */
    @Transactional(readOnly = true)
    public Map<String, Object> getTransactionStatus(String checkoutRequestId, Long requesterId) {
        MpesaTransaction t = mpesaTransactionRepository.findByCheckoutRequestId(checkoutRequestId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));
        if (t.getUser() == null || !t.getUser().getUserId().equals(requesterId)) {
            throw new org.springframework.security.access.AccessDeniedException("This payment belongs to another user");
        }
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("checkout_request_id", t.getCheckoutRequestId());
        m.put("status", t.getStatus());
        m.put("amount", t.getAmount());
        m.put("receipt", t.getMpesaReceipt());
        m.put("message", t.getResultDesc());
        return m;
    }

    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> getContributionsByChamaId(Long chamaId, Long requesterId) {
        if (!chamaMemberRepository.existsByChamaChamaIdAndUserUserIdAndIsActiveTrue(chamaId, requesterId)) {
            throw new org.springframework.security.access.AccessDeniedException("You are not an active member of this chama");
        }
        log.info("Fetching contributions for chama ID: {}", chamaId);
        return contributionRepository.findByChamaChamaIdAndIsDeletedFalse(chamaId).stream()
                .map(ContributionSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }
    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> getMyContributions(Long userId) {
        log.info("Fetching contributions for user ID: {}", userId);
        return contributionRepository.findByUserUserIdAndIsDeletedFalse(userId).stream()
                .map(ContributionSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }
}

