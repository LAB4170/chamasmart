package com.chamasmart.backend.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProductionConfigGuardTest {
    private ProductionConfigGuard safe() {
        ProductionConfigGuard g = new ProductionConfigGuard();
        g.environment = "production"; g.jwtSecret = "x".repeat(40); g.dataKey = "k"; g.documentKey = "d"; g.cors = "https://chamasmart.netlify.app";
        g.adminMfa = true; g.mailProvider = "brevo"; g.ddlAuto = "validate"; g.mpesaEnv = "production";
        g.consumerKey = "ck"; g.consumerSecret = "cs"; g.callbackSecret = "cb"; g.c2bSecret = "c2"; g.passkey = "pk"; g.shortcode = "400200";
        return g;
    }

    @Test void aCompleteSetupPasses() {
        ProductionConfigGuard g = safe();
        assertTrue(g.problems().isEmpty());
        assertDoesNotThrow(g::check);
    }

    @Test void productionRefusesToStartWithUnsafeSettings() {
        ProductionConfigGuard g = safe();
        g.jwtSecret = "short"; g.consumerSecret = "YOUR_DARAJA_SANDBOX_CONSUMER_SECRET"; g.shortcode = "174379"; g.ddlAuto = "update"; g.adminMfa = false; g.cors = "http://localhost:5173";
        assertEquals(6, g.problems().size());
        IllegalStateException e = assertThrows(IllegalStateException.class, g::check);
        assertTrue(e.getMessage().contains("MPESA_CONSUMER_SECRET"));
    }

    @Test void developmentOnlyWarns() {
        ProductionConfigGuard g = safe();
        g.environment = "development"; g.jwtSecret = "";
        assertFalse(g.problems().isEmpty());
        assertDoesNotThrow(g::check);
    }

    @Test void sandboxMpesaNeedsNoLiveKeys() {
        ProductionConfigGuard g = safe();
        g.mpesaEnv = "sandbox"; g.consumerKey = ""; g.consumerSecret = ""; g.passkey = ""; g.shortcode = "174379";
        assertTrue(g.problems().isEmpty());
    }
}
