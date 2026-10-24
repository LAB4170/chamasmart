package com.chamasmart.backend.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** For local testing only (MAIL_PROVIDER=log): prints the whole message, links included. Never use in production. */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "log")
public class LogMail implements OutboundMail {
    @Override public boolean send(String toEmail, String subject, String htmlBody) {
        log.info("MAIL-TO={} SUBJECT={} BODY={}", toEmail, subject, htmlBody);
        return true;
    }
    @Override public boolean isConfigured() { return true; }
}
