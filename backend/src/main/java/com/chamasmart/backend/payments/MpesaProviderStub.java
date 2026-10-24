package com.chamasmart.backend.payments;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Placeholder so the workflow can name M-Pesa. It stays unconfigured, so it can never be chosen, until payments are approved and built. */
@Component
public class MpesaProviderStub implements PaymentProvider {
    @Override public String code() { return "MPESA"; }
    @Override public String displayName() { return "M-Pesa prompt on your phone"; }
    @Override public boolean isConfigured() { return false; }
    @Override public boolean confirmsAutomatically() { return true; }
    @Override public String instructions(String chamaName, BigDecimal amount) { return "Not available yet."; }
}
