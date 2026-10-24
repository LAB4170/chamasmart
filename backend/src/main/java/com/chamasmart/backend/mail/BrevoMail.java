package com.chamasmart.backend.mail;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Sends through Brevo's HTTPS API. An API call is used rather than SMTP because Render's free instances block SMTP ports.
 * Needs BREVO_API_KEY and a sender address that is verified in Brevo (MAIL_FROM_EMAIL).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "brevo")
public class BrevoMail implements OutboundMail {
    private final String apiKey;
    private final String fromEmail;
    private final String fromName;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    public BrevoMail(@Value("${app.mail.brevo-api-key:}") String apiKey,
                     @Value("${app.mail.from-email:}") String fromEmail,
                     @Value("${app.mail.from-name:ChamaSmart}") String fromName) {
        this.apiKey = apiKey; this.fromEmail = fromEmail; this.fromName = fromName;
    }

    @Override public boolean isConfigured() { return !apiKey.isBlank() && !fromEmail.isBlank(); }

    @Override public boolean send(String toEmail, String subject, String htmlBody) {
        if (!isConfigured()) { log.warn("Brevo is selected but BREVO_API_KEY or MAIL_FROM_EMAIL is missing"); return false; }
        try {
            String json = mapper.writeValueAsString(Map.of("sender", Map.of("name", fromName, "email", fromEmail),
                    "to", List.of(Map.of("email", toEmail)), "subject", subject, "htmlContent", htmlBody));
            HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create("https://api.brevo.com/v3/smtp/email")).timeout(Duration.ofSeconds(10))
                    .header("api-key", apiKey).header("content-type", "application/json").header("accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json)).build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() / 100 != 2) { log.warn("Brevo refused an email: HTTP {}", r.statusCode()); return false; }
            return true;
        } catch (Exception e) {
            log.warn("Sending an email failed: {}", e.getClass().getSimpleName());
            return false;
        }
    }
}
