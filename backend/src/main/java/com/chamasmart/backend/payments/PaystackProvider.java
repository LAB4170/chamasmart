package com.chamasmart.backend.payments;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * Card (Visa, Mastercard) and M-Pesa checkout through Paystack, which is licensed in Kenya. It switches itself on only when a secret key is
 * set AND payments.paystack.enabled is true. Money is never credited here: a signed webhook is matched to an intent by PaymentEventService.
 */
@Component
public class PaystackProvider implements PaymentProvider {
    @Value("${app.payments.paystack.secret-key:}") private String secretKey;
    @Value("${app.payments.paystack.enabled:false}") private boolean enabled;
    @Value("${app.payments.paystack.base-url:https://api.paystack.co}") private String baseUrl;
    @Value("${app.payments.paystack.callback-url:}") private String callbackUrl;
    private final RestTemplate http = new RestTemplate();

    @Override public String code() { return "PAYSTACK"; }
    @Override public String displayName() { return "Card or M-Pesa checkout"; }
    @Override public boolean isConfigured() { return enabled && secretKey != null && !secretKey.isBlank(); }
    @Override public boolean confirmsAutomatically() { return true; }
    @Override public String instructions(String chamaName, BigDecimal amount) {
        return "You will be taken to a secure checkout to pay " + amount.toPlainString() + " to " + chamaName + " by card or M-Pesa. It is credited when the payment is confirmed.";
    }

    /** Whether the body really came from Paystack: HMAC-SHA512 of the raw body with the secret key, compared in constant time. */
    public boolean validSignature(String rawBody, String signature) {
        if (secretKey == null || secretKey.isBlank() || signature == null || rawBody == null) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            StringBuilder hex = new StringBuilder();
            for (byte b : mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8))) hex.append(String.format("%02x", b));
            return MessageDigest.isEqual(hex.toString().getBytes(StandardCharsets.UTF_8), signature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) { return false; }
    }

    /** Starts a hosted checkout and returns its address. Amount is in the currency's major unit; Paystack takes minor units. */
    @SuppressWarnings("unchecked")
    public String initialize(String email, BigDecimal amount, String currency, String reference, long intentId, long chamaId) {
        if (!isConfigured()) throw new IllegalStateException("Card checkout is not switched on");
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(secretKey);
        h.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("amount", toMinor(amount));
        body.put("currency", currency);
        body.put("reference", reference);
        if (callbackUrl != null && !callbackUrl.isBlank()) body.put("callback_url", callbackUrl);
        body.put("metadata", Map.of("intent_id", intentId, "chama_id", chamaId));
        ResponseEntity<Map> r = http.exchange(baseUrl + "/transaction/initialize", HttpMethod.POST, new HttpEntity<>(body, h), Map.class);
        Map<String, Object> data = r.getBody() == null ? null : (Map<String, Object>) r.getBody().get("data");
        if (data == null || data.get("authorization_url") == null) throw new IllegalStateException("The payment provider did not return a checkout address");
        return data.get("authorization_url").toString();
    }

    public static long toMinor(BigDecimal major) { return major.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).longValueExact(); }
}
