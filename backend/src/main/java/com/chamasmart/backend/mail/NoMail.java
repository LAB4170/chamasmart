package com.chamasmart.backend.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Default: nothing is sent and the body, which holds a one-time link, is never written to the log. */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "none", matchIfMissing = true)
public class NoMail implements OutboundMail {
    @Override public boolean send(String toEmail, String subject, String htmlBody) {
        log.warn("An email was not sent because no mail provider is set up (set MAIL_PROVIDER and its key). Subject: {}", subject);
        return false;
    }
    @Override public boolean isConfigured() { return false; }
}
