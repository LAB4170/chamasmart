package com.chamasmart.backend.service;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** What a member of staff can be allowed to do. Roles are sets of these. */
public enum Permission {
    OVERVIEW_VIEW, STAFF_MANAGE, SETTINGS_MANAGE, AUDIT_VIEW,
    VERIFY_VIEW, VERIFY_REVIEW, LISTING_APPROVE,
    AGREEMENT_MANAGE,
    CASE_VIEW, CASE_OPEN, CASE_ESCALATE, CASE_RESOLVE,
    FINANCE_VIEW;

    /** Powers that only the built-in super admin role can hold. */
    public static final Set<Permission> SUPER_ONLY = Set.of(STAFF_MANAGE, SETTINGS_MANAGE);

    public static Set<String> names() { return Arrays.stream(values()).map(Enum::name).collect(Collectors.toSet()); }
}
