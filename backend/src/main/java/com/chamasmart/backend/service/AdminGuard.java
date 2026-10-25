package com.chamasmart.backend.service;

import com.chamasmart.backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Every console action passes here. The person must be an active member of staff with two-factor sign-in and the specific permission the action needs.
 * Refusals are written to the trail; so is every successful read of personal data.
 */
@Service
@RequiredArgsConstructor
public class AdminGuard {
    public record Actor(Long userId, Set<String> roles, Set<Permission> permissions) {
        public boolean has(Permission p) { return permissions.contains(p); }
    }

    private final JdbcTemplate jdbc;
    private final MfaService mfa;
    private final AdminAuditService trail;

    @Value("${app.admin.require-mfa:true}") boolean requireMfa = true;

    public Actor require(CustomUserDetails me, Permission needed) {
        return require(me, needed, null);
    }

    /** Checks access; when {@code readLabel} is given, a successful read is also written to the trail. */
    public Actor require(CustomUserDetails me, Permission needed, String readLabel) {
        return require(me, needed, readLabel, null);
    }

    public Actor require(CustomUserDetails me, Permission needed, String readLabel, Long chamaId) {
        Long uid = me == null ? null : me.getUserId();
        if (me == null || me.getAuthorities().stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) deny(uid, needed, chamaId, "not staff");
        bootstrapFirstSuperAdmin(uid);
        List<String> st = jdbc.queryForList("SELECT status FROM staff_accounts WHERE user_id = ?", String.class, uid);
        if (st.isEmpty() || !"ACTIVE".equals(st.get(0))) deny(uid, needed, chamaId, st.isEmpty() ? "no staff account" : "staff account " + st.get(0).toLowerCase());
        if (requireMfa && !mfa.isEnabled(uid)) deny(uid, needed, chamaId, "two-factor sign-in is off");
        Actor a = actor(uid);
        if (needed != null && !a.has(needed)) deny(uid, needed, chamaId, "role lacks " + needed);
        if (readLabel != null) trail.append(uid, "VIEWED_" + readLabel, chamaId, null, "ALLOWED");
        return a;
    }

    public Actor actor(Long uid) {
        Set<String> roles = new TreeSet<>(jdbc.queryForList("SELECT role_code FROM staff_assignments WHERE user_id = ?", String.class, uid));
        Set<Permission> perms = new HashSet<>();
        if (!roles.isEmpty()) {
            String in = roles.stream().map(r -> "?").collect(Collectors.joining(","));
            for (String p : jdbc.queryForList("SELECT DISTINCT permission FROM role_permissions WHERE role_code IN (" + in + ")", String.class, roles.toArray()))
                try { perms.add(Permission.valueOf(p)); } catch (IllegalArgumentException ignored) { /* removed permission */ }
        }
        return new Actor(uid, roles, perms);
    }

    /** The first administrator promoted by hand becomes super admin, so the console can be opened at all. */
    private void bootstrapFirstSuperAdmin(Long uid) {
        Integer supers = jdbc.queryForObject("SELECT count(*) FROM staff_assignments WHERE role_code = 'SUPER_ADMIN'", Integer.class);
        if (supers != null && supers > 0) return;
        jdbc.update("INSERT INTO staff_accounts (user_id) VALUES (?) ON CONFLICT DO NOTHING", uid);
        jdbc.update("INSERT INTO staff_assignments (user_id, role_code) VALUES (?, 'SUPER_ADMIN') ON CONFLICT DO NOTHING", uid);
        trail.append(uid, "SUPER_ADMIN_BOOTSTRAPPED", null, "first administrator became super admin", "ALLOWED");
    }

    private void deny(Long uid, Permission needed, Long chamaId, String why) {
        trail.appendIsolated(uid, "DENIED_" + (needed == null ? "ACCESS" : needed.name()), chamaId, why, "DENIED");
        throw new AccessDeniedException(why.startsWith("two-factor") ? "Turn on two-factor sign-in before using the admin console" : "You do not have access to this");
    }

    /** Writes the record of something staff did. Call inside the transaction of the action. */
    public void log(Long adminId, String action, Long chamaId, String detail) {
        trail.append(adminId, action, chamaId, detail, "ALLOWED");
    }

    public boolean twoPerson() {
        List<String> v = jdbc.queryForList("SELECT setting_value FROM platform_settings WHERE setting_key = 'two_person_rule'", String.class);
        return !v.isEmpty() && "true".equalsIgnoreCase(v.get(0));
    }
}
