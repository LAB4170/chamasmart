package com.chamasmart.backend.security;

import java.util.List;
import java.util.Locale;

/**
 * The one place that says who can do what inside a chama.
 *
 * Officials (chairperson, treasurer, secretary) can do the day-to-day official work in every kind of chama: record and verify
 * payments, approve loans and claims, run cycles, hold meetings. Money rules still apply on top of this (nobody approves their own
 * money, large amounts need a second official).
 *
 * Only the chairperson can: change anyone's role, remove an official, retire the chama, hand over the chair, invite another official.
 * Ordinary members can: see their own records and the group's totals, submit payments and claims, apply for loans, vote.
 */
public final class RolePolicy {
    private RolePolicy() {}

    public static final List<String> OFFICIALS = List.of("CHAIRPERSON", "TREASURER", "SECRETARY");

    private static String norm(String role) { return role == null ? "" : role.trim().toUpperCase(Locale.ROOT); }

    public static boolean isOfficial(String role) { return OFFICIALS.contains(norm(role)); }

    public static boolean isChairperson(String role) { return "CHAIRPERSON".equals(norm(role)); }
}
