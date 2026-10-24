package com.chamasmart.backend.payments;

/**
 * A way of collecting money. Only the manual provider exists today: the member pays outside the app (M-Pesa, bank, cash) and
 * submits the reference, then an official verifies it. A real provider (M-Pesa STK, card) would implement this and switch itself on
 * only when its credentials and the explicit approval to use it are in place. Nothing here moves money by itself.
 */
public interface PaymentProvider {
    /** Stable code stored on the intent, for example MANUAL or MPESA. */
    String code();

    /** Shown to the member. */
    String displayName();

    /** False until the provider is fully set up and approved; unconfigured providers can never be chosen. */
    boolean isConfigured();

    /** True when the money is confirmed by the provider itself; false when an official has to verify it. */
    boolean confirmsAutomatically();

    /** What the member should do next, in plain words. */
    String instructions(String chamaName, java.math.BigDecimal amount);
}
