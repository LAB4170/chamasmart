package com.chamasmart.backend.mail;

/** Sends one email. Implementations never throw: a failed send is logged (without the message body) and reported as false. */
public interface OutboundMail {
    boolean send(String toEmail, String subject, String htmlBody);

    /** False when no provider is set up, so callers can say so instead of pretending. */
    boolean isConfigured();
}
