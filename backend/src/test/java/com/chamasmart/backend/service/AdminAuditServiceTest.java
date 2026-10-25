package com.chamasmart.backend.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AdminAuditServiceTest {
    @Test
    void theHashDependsOnEveryFieldAndOnThePreviousRow() {
        String base = AdminAuditService.hash(1, 5L, "APPROVED", 9L, "ok", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "GENESIS");
        assertEquals(base, AdminAuditService.hash(1, 5L, "APPROVED", 9L, "ok", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "GENESIS"));
        assertEquals(64, base.length());
        assertNotEquals(base, AdminAuditService.hash(2, 5L, "APPROVED", 9L, "ok", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "GENESIS"));
        assertNotEquals(base, AdminAuditService.hash(1, 6L, "APPROVED", 9L, "ok", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "GENESIS"));
        assertNotEquals(base, AdminAuditService.hash(1, 5L, "REJECTED", 9L, "ok", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "GENESIS"));
        assertNotEquals(base, AdminAuditService.hash(1, 5L, "APPROVED", 9L, "changed", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "GENESIS"));
        assertNotEquals(base, AdminAuditService.hash(1, 5L, "APPROVED", 9L, "ok", 1000L, "DENIED", "SUPER_ADMIN", "1.2.3.4", "GENESIS"));
        assertNotEquals(base, AdminAuditService.hash(1, 5L, "APPROVED", 9L, "ok", 1000L, "ALLOWED", "LEGAL", "1.2.3.4", "GENESIS"));
        assertNotEquals(base, AdminAuditService.hash(1, 5L, "APPROVED", 9L, "ok", 1000L, "ALLOWED", "SUPER_ADMIN", "1.2.3.4", "OTHER"));
    }

    @Test
    void staffAndSettingsPowersAreSuperAdminOnly() {
        assertTrue(Permission.SUPER_ONLY.contains(Permission.STAFF_MANAGE));
        assertTrue(Permission.SUPER_ONLY.contains(Permission.SETTINGS_MANAGE));
        assertFalse(Permission.SUPER_ONLY.contains(Permission.FINANCE_VIEW));
    }
}
