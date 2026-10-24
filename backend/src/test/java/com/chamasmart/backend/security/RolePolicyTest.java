package com.chamasmart.backend.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RolePolicyTest {
    @Test void allThreeOfficerRolesAreOfficials() {
        for (String r : new String[]{"CHAIRPERSON", "TREASURER", "SECRETARY", "treasurer", " Secretary "}) assertTrue(RolePolicy.isOfficial(r), r);
    }
    @Test void membersAndUnknownRolesAreNot() {
        for (String r : new String[]{"MEMBER", "", null, "ADMIN", "VICE"}) assertFalse(RolePolicy.isOfficial(r), String.valueOf(r));
    }
    @Test void onlyTheChairpersonIsChair() {
        assertTrue(RolePolicy.isChairperson("chairperson"));
        assertFalse(RolePolicy.isChairperson("TREASURER"));
    }
}
