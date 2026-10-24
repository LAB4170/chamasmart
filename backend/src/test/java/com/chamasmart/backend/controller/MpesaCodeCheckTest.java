package com.chamasmart.backend.controller;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MpesaCodeCheckTest {
    @Test void acceptsTenCharacterCodesAndUppercasesThem() { assertEquals("RCA1X3DE5Y", ContributionController.checkedReference("MPESA", " rca1x3de5y ")); }
    @Test void refusesWrongLength() { assertThrows(IllegalArgumentException.class, () -> ContributionController.checkedReference("MPESA", "RCA1X3")); }
    @Test void refusesSymbols() { assertThrows(IllegalArgumentException.class, () -> ContributionController.checkedReference("MPESA", "RCA1X3DE5-")); }
    @Test void otherMethodsAreNotChecked() { assertEquals("CHQ-44", ContributionController.checkedReference("CASH", "CHQ-44")); }
    @Test void blankReferenceIsLeftForTheServiceToGenerate() { assertNull(ContributionController.checkedReference("MPESA", null)); }
}
