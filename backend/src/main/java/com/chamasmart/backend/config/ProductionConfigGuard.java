package com.chamasmart.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Checks the live settings once at startup. With APP_ENV=production an unsafe or missing setting stops the app from starting, so a
 * misconfiguration is found at deploy time and not when the first member pays. In any other environment the same findings are logged as warnings.
 */
@Component
@Slf4j
public class ProductionConfigGuard {
    @Value("${app.environment:development}") String environment = "development";
    @Value("${app.security.jwt.secret:}") String jwtSecret = "";
    @Value("${app.security.data-key:}") String dataKey = "";
    @Value("${app.documents.key:}") String documentKey = "";
    @Value("${app.cors.allowed-origins:}") String cors = "";
    @Value("${app.admin.require-mfa:true}") boolean adminMfa = true;
    @Value("${app.mail.provider:none}") String mailProvider = "none";
    @Value("${spring.jpa.hibernate.ddl-auto:update}") String ddlAuto = "update";
    @Value("${app.mpesa.env:sandbox}") String mpesaEnv = "sandbox";
    @Value("${app.mpesa.consumer-key:}") String consumerKey = "";
    @Value("${app.mpesa.consumer-secret:}") String consumerSecret = "";
    @Value("${app.mpesa.callback-secret:}") String callbackSecret = "";
    @Value("${app.mpesa.c2b-secret:}") String c2bSecret = "";
    @Value("${app.mpesa.passkey:}") String passkey = "";
    @Value("${app.mpesa.shortcode:}") String shortcode = "";
    @Value("${app.payments.paystack.enabled:false}") boolean paystack = false;
    @Value("${app.payments.paystack.secret-key:}") String paystackKey = "";

    public List<String> problems() {
        List<String> p = new ArrayList<>();
        if (jwtSecret == null || jwtSecret.length() < 32) p.add("JWT_SECRET must be at least 32 characters");
        if (blank(dataKey)) p.add("DATA_ENCRYPTION_KEY is not set");
        if (blank(documentKey)) p.add("DOCUMENT_ENCRYPTION_KEY is not set (stored documents would use a key derived from DATA_ENCRYPTION_KEY)");
        if (cors != null && (cors.contains("localhost") || cors.contains("127.0.0.1"))) p.add("CORS_ORIGIN still allows localhost");
        if (!adminMfa) p.add("ADMIN_REQUIRE_MFA is off: the admin console would accept sign-ins without two-factor");
        if (blank(mailProvider) || "none".equalsIgnoreCase(mailProvider) || "log".equalsIgnoreCase(mailProvider)) p.add("MAIL_PROVIDER sends no real email: no verification, reset or fingerprint emails");
        if (!"validate".equalsIgnoreCase(ddlAuto)) p.add("SPRING_JPA_DDL_AUTO should be validate; migrations own the schema");
        if (paystack && blank(paystackKey)) p.add("PAYSTACK_ENABLED is true but PAYSTACK_SECRET_KEY is empty");
        if ("production".equalsIgnoreCase(mpesaEnv)) {
            if (blank(consumerKey)) p.add("MPESA_CONSUMER_KEY is not set");
            if (blank(consumerSecret) || consumerSecret.contains("YOUR_DARAJA")) p.add("MPESA_CONSUMER_SECRET is not set");
            if (blank(callbackSecret)) p.add("MPESA_CALLBACK_SECRET is not set");
            if (blank(c2bSecret)) p.add("MPESA_C2B_SECRET is not set");
            if (blank(passkey)) p.add("MPESA_PASSKEY is not set");
            if (blank(shortcode) || "174379".equals(shortcode)) p.add("MPESA_SHORTCODE is empty or still the sandbox shortcode");
        }
        return p;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void check() {
        List<String> p = problems();
        if (p.isEmpty()) { log.info("Configuration check passed"); return; }
        if ("production".equalsIgnoreCase(environment)) {
            throw new IllegalStateException("Refusing to start in production with unsafe settings:\n - " + String.join("\n - ", p));
        }
        log.warn("Configuration check (would stop a production start):\n - {}", String.join("\n - ", p));
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
}
