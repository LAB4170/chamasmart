package com.chamasmart.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Who works on the platform, what they may do, and the settings only the super admin can change. Every change is written to the trail in the same transaction. */
@Service
@RequiredArgsConstructor
public class StaffService {
    private final JdbcTemplate jdbc;
    private final AdminGuard guard;

    public Map<String, Object> me(Long userId) {
        var a = guard.actor(userId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("user_id", userId);
        m.put("roles", a.roles());
        m.put("permissions", a.permissions().stream().map(Enum::name).sorted().toList());
        m.put("two_person_rule", guard.twoPerson());
        return m;
    }

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT s.user_id, s.status, s.created_at, u.first_name, u.last_name, u.email,
                       (SELECT max(a.at) FROM admin_actions a WHERE a.admin_id = s.user_id) AS last_action_at
                FROM staff_accounts s JOIN users u ON u.user_id = s.user_id ORDER BY s.created_at""");
        for (Map<String, Object> r : rows) {
            Long id = ((Number) r.get("user_id")).longValue();
            r.put("roles", jdbc.queryForList("SELECT role_code FROM staff_assignments WHERE user_id = ? ORDER BY role_code", String.class, id));
            r.put("mfa_on", Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM user_mfa WHERE user_id = ? AND enabled = true)", Boolean.class, id)));
        }
        return rows;
    }

    public List<Map<String, Object>> roles() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT role_code, label, description, system_role FROM staff_roles ORDER BY system_role DESC, role_code");
        for (Map<String, Object> r : rows)
            r.put("permissions", jdbc.queryForList("SELECT permission FROM role_permissions WHERE role_code = ? ORDER BY permission", String.class, r.get("role_code")));
        return rows;
    }

    @Transactional
    public Map<String, Object> add(Long actorId, String email, List<String> roles) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("Enter the email of the person's ChamaSmart account");
        checkRoles(roles);
        var u = jdbc.queryForList("SELECT user_id, email_verified, role FROM users WHERE lower(email) = lower(?)", email.trim());
        if (u.isEmpty()) throw new IllegalArgumentException("No account with that email. Ask them to register first");
        Long id = ((Number) u.get(0).get("user_id")).longValue();
        if (!Boolean.TRUE.equals(u.get(0).get("email_verified"))) throw new IllegalStateException("They must confirm their email first");
        Integer chamas = jdbc.queryForObject("SELECT count(*) FROM chama_members WHERE user_id = ? AND is_active = true", Integer.class, id);
        if (chamas != null && chamas > 0) throw new IllegalStateException("Staff cannot be active members of a chama, because that creates a conflict of interest. Use a separate staff account");
        var ex = jdbc.queryForList("SELECT status FROM staff_accounts WHERE user_id = ?", String.class, id);
        if (!ex.isEmpty() && !"REMOVED".equals(ex.get(0))) throw new IllegalStateException("They are already on the staff");
        if (ex.isEmpty()) jdbc.update("INSERT INTO staff_accounts (user_id, created_by) VALUES (?,?)", id, actorId);
        else jdbc.update("UPDATE staff_accounts SET status = 'ACTIVE', changed_by = ?, changed_at = now() WHERE user_id = ?", actorId, id);
        jdbc.update("DELETE FROM staff_assignments WHERE user_id = ?", id);
        for (String r : roles) jdbc.update("INSERT INTO staff_assignments (user_id, role_code) VALUES (?,?)", id, r);
        jdbc.update("UPDATE users SET role = 'ADMIN' WHERE user_id = ?", id);
        guard.log(actorId, "STAFF_ADDED", null, "user " + id + " given " + roles);
        return Map.of("user_id", id, "roles", roles);
    }

    @Transactional
    public Map<String, Object> setRoles(Long actorId, Long userId, List<String> roles) {
        checkRoles(roles);
        if (actorId.equals(userId)) throw new IllegalStateException("You cannot change your own roles");
        requireActiveStaff(userId);
        List<String> before = jdbc.queryForList("SELECT role_code FROM staff_assignments WHERE user_id = ? ORDER BY role_code", String.class, userId);
        if (before.contains("SUPER_ADMIN") && !roles.contains("SUPER_ADMIN")) requireAnotherSuper(userId);
        jdbc.update("DELETE FROM staff_assignments WHERE user_id = ?", userId);
        for (String r : roles) jdbc.update("INSERT INTO staff_assignments (user_id, role_code) VALUES (?,?)", userId, r);
        jdbc.update("UPDATE users SET token_version = coalesce(token_version,0) + 1 WHERE user_id = ?", userId);
        guard.log(actorId, "STAFF_ROLES_CHANGED", null, "user " + userId + ": " + before + " to " + roles);
        return Map.of("user_id", userId, "roles", roles);
    }

    @Transactional
    public Map<String, Object> setStatus(Long actorId, Long userId, String to) {
        if (actorId.equals(userId)) throw new IllegalStateException("You cannot do this to your own account");
        var cur = jdbc.queryForList("SELECT status FROM staff_accounts WHERE user_id = ? FOR UPDATE", String.class, userId);
        if (cur.isEmpty()) throw new IllegalArgumentException("That person is not on the staff");
        String from = cur.get(0);
        switch (to) {
            case "SUSPENDED" -> { if (!"ACTIVE".equals(from)) throw new IllegalStateException("Only an active account can be suspended"); }
            case "ACTIVE" -> { if (!"SUSPENDED".equals(from)) throw new IllegalStateException("Only a suspended account can be reinstated"); }
            case "REMOVED" -> { if ("REMOVED".equals(from)) throw new IllegalStateException("Already removed"); }
            default -> throw new IllegalArgumentException("Unknown status");
        }
        if (!"ACTIVE".equals(to) && jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM staff_assignments WHERE user_id = ? AND role_code = 'SUPER_ADMIN')", Boolean.class, userId) && "ACTIVE".equals(from))
            requireAnotherSuper(userId);
        jdbc.update("UPDATE staff_accounts SET status = ?, changed_by = ?, changed_at = now() WHERE user_id = ?", to, actorId, userId);
        if ("REMOVED".equals(to)) jdbc.update("UPDATE users SET role = 'MEMBER' WHERE user_id = ?", userId);
        if ("ACTIVE".equals(to)) jdbc.update("UPDATE users SET role = 'ADMIN' WHERE user_id = ?", userId);
        if (!"ACTIVE".equals(to)) jdbc.update("UPDATE users SET token_version = coalesce(token_version,0) + 1 WHERE user_id = ?", userId);
        guard.log(actorId, "STAFF_" + to, null, "user " + userId + " was " + from.toLowerCase());
        return Map.of("user_id", userId, "status", to);
    }

    @Transactional
    public Map<String, Object> saveRole(Long actorId, String code, String label, String description, List<String> permissions) {
        if (code == null || !code.matches("[A-Z][A-Z_]{2,39}")) throw new IllegalArgumentException("Role code: capital letters and underscores, 3 to 40 characters");
        if (label == null || label.isBlank()) throw new IllegalArgumentException("Give the role a name");
        if (permissions == null || permissions.isEmpty()) throw new IllegalArgumentException("Choose at least one permission");
        for (String p : permissions) {
            if (!Permission.names().contains(p)) throw new IllegalArgumentException("Unknown permission " + p);
            if (Permission.SUPER_ONLY.contains(Permission.valueOf(p))) throw new IllegalArgumentException(p + " can only belong to the super admin role");
        }
        var ex = jdbc.queryForList("SELECT system_role FROM staff_roles WHERE role_code = ?", Boolean.class, code);
        if (!ex.isEmpty() && ex.get(0)) throw new IllegalStateException("Built-in roles cannot be changed. Create a new role instead");
        if (ex.isEmpty()) jdbc.update("INSERT INTO staff_roles (role_code, label, description, created_by) VALUES (?,?,?,?)", code, label.trim(), description, actorId);
        else jdbc.update("UPDATE staff_roles SET label = ?, description = ? WHERE role_code = ?", label.trim(), description, code);
        jdbc.update("DELETE FROM role_permissions WHERE role_code = ?", code);
        for (String p : new TreeSet<>(permissions)) jdbc.update("INSERT INTO role_permissions (role_code, permission) VALUES (?,?)", code, p);
        guard.log(actorId, ex.isEmpty() ? "ROLE_CREATED" : "ROLE_CHANGED", null, code + ": " + new TreeSet<>(permissions));
        return Map.of("role_code", code);
    }

    public Map<String, Object> settings() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("two_person_rule", guard.twoPerson());
        m.put("approvers", countWith("LISTING_APPROVE"));
        m.put("escalators", countWith("CASE_ESCALATE"));
        jdbc.query("SELECT setting_value, updated_at FROM platform_settings WHERE setting_key = 'audit_chain_last'", rs -> { m.put("audit_chain_last", rs.getString(1)); });
        return m;
    }

    @Transactional
    public Map<String, Object> setTwoPerson(Long actorId, boolean on) {
        if (on && (countWith("LISTING_APPROVE") < 2 || countWith("CASE_ESCALATE") < 2))
            throw new IllegalStateException("Needs at least two active people who can approve listings and two who can confirm serious notices. Otherwise nothing could be approved");
        jdbc.update("INSERT INTO platform_settings (setting_key, setting_value, updated_by) VALUES ('two_person_rule', ?, ?) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = now()", String.valueOf(on), actorId);
        guard.log(actorId, on ? "TWO_PERSON_ON" : "TWO_PERSON_OFF", null, null);
        return settings();
    }

    // ---------- helpers ----------

    private int countWith(String permission) {
        Integer n = jdbc.queryForObject("""
                SELECT count(DISTINCT s.user_id) FROM staff_accounts s JOIN staff_assignments a ON a.user_id = s.user_id
                JOIN role_permissions p ON p.role_code = a.role_code WHERE s.status = 'ACTIVE' AND p.permission = ?""", Integer.class, permission);
        return n == null ? 0 : n;
    }

    private void checkRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) throw new IllegalArgumentException("Choose at least one role");
        for (String r : roles) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM staff_roles WHERE role_code = ?", Integer.class, r);
            if (n == null || n == 0) throw new IllegalArgumentException("Unknown role " + r);
        }
    }

    private void requireActiveStaff(Long userId) {
        var st = jdbc.queryForList("SELECT status FROM staff_accounts WHERE user_id = ?", String.class, userId);
        if (st.isEmpty() || !"ACTIVE".equals(st.get(0))) throw new IllegalStateException("That account is not an active member of staff");
    }

    private void requireAnotherSuper(Long except) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM staff_accounts s JOIN staff_assignments a ON a.user_id = s.user_id
                WHERE s.status = 'ACTIVE' AND a.role_code = 'SUPER_ADMIN' AND s.user_id <> ?""", Integer.class, except);
        if (n == null || n == 0) throw new IllegalStateException("There must always be at least one other active super admin");
    }
}
