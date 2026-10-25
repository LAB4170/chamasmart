package com.chamasmart.backend.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class BillingServiceTest {
    private BillingService svc(boolean registered, boolean inclusive) {
        BillingService b = new BillingService(mock(JdbcTemplate.class));
        b.vatRegistered = registered; b.vatInclusive = inclusive;
        return b;
    }

    @Test void noVatUntilRegistered() {
        BigDecimal[] s = svc(false, true).split(new BigDecimal("1500.00"));
        assertEquals(0, s[0].compareTo(new BigDecimal("1500.00")));
        assertEquals(0, s[1].signum());
        assertEquals(0, s[2].compareTo(new BigDecimal("1500.00")));
    }

    @Test void inclusiveVatIsBackedOut() {
        BigDecimal[] s = svc(true, true).split(new BigDecimal("1160.00"));
        assertEquals(new BigDecimal("1000.00"), s[0]);
        assertEquals(new BigDecimal("160.00"), s[1]);
        assertEquals(0, s[2].compareTo(new BigDecimal("1160.00")));
    }

    @Test void exclusiveVatIsAdded() {
        BigDecimal[] s = svc(true, false).split(new BigDecimal("1000.00"));
        assertEquals(new BigDecimal("160.00"), s[1]);
        assertEquals(new BigDecimal("1160.00"), s[2]);
    }
}
