package com.chamasmart.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class LegalServiceTest {
    @Test void formulasInTextAreNeutralised() {
        assertEquals("'=HYPERLINK(\"x\")".replace("\"", "\"\""), LegalService.cell("=HYPERLINK(\"x\")").replaceAll("^\"|\"$", ""));
        assertEquals("'+254700000000", LegalService.cell("+254700000000"));
        assertEquals("'@cmd", LegalService.cell("@cmd"));
    }

    @Test void numbersAndPlainTextPassThrough() {
        assertEquals("1500.00", LegalService.cell(new java.math.BigDecimal("1500.00")));
        assertEquals("-5", LegalService.cell(-5));
        assertEquals("Wanjiku Group", LegalService.cell("Wanjiku Group"));
        assertEquals("\"a,b\"", LegalService.cell("a,b"));
        assertEquals("", LegalService.cell(null));
    }
}
