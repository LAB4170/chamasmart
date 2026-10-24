package com.chamasmart.backend.payments;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class ManualProvider implements PaymentProvider {
    @Override public String code() { return "MANUAL"; }
    @Override public String displayName() { return "Pay outside the app and submit the reference"; }
    @Override public boolean isConfigured() { return true; }
    @Override public boolean confirmsAutomatically() { return false; }
    @Override public String instructions(String chamaName, BigDecimal amount) {
        return "Pay KES " + amount.toPlainString() + " using the way your officials have shared for " + chamaName
                + " (for example the chama's M-Pesa number). Then enter the M-Pesa code or bank reference here. An official verifies it before it counts.";
    }
}
