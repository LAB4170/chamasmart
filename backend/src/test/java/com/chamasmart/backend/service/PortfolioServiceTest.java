package com.chamasmart.backend.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class PortfolioServiceTest {
    static PortfolioService.Row row(int held, Boolean reconciled, Boolean books, String planStatus) {
        return new PortfolioService.Row(1L, "Alpha", "ROSCA", "CHAIRPERSON", "KES", new BigDecimal("1000"), 10, held, BigDecimal.ZERO, 0, reconciled, null, "STARTER", planStatus, books, null);
    }

    @Test
    void aCleanChamaDoesNotNeedAttention() {
        assertFalse(row(0, true, true, "ACTIVE").needsAttention());
        assertFalse(row(0, null, null, "TRIAL").needsAttention());
    }

    @Test
    void anyOneProblemFlagsItAndSaysWhy() {
        assertTrue(row(2, true, true, "ACTIVE").needsAttention());
        assertTrue(row(0, false, true, "ACTIVE").needsAttention());
        assertTrue(row(0, true, false, "ACTIVE").needsAttention());
        assertTrue(row(0, true, true, "PAST_DUE").needsAttention());
        assertTrue(row(0, true, true, "SUSPENDED").needsAttention());
        assertEquals(java.util.List.of("2 held payments", "Books check failed"), row(2, true, false, "ACTIVE").reasons());
        assertEquals(java.util.List.of("1 held payment"), row(1, true, true, "ACTIVE").reasons());
    }
}
