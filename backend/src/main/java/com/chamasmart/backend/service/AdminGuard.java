package com.chamasmart.backend.service;

import com.chamasmart.backend.security.ClientIp;
import com.chamasmart.backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

/** Every platform operator action goes through here: it must be an administrator with two-factor sign-in, and it leaves a trail that cannot be edited. */
@Service
@RequiredArgsConstructor
public class AdminGuard {
    private final JdbcTemplate jdbc;
    private final MfaService mfa;

    @Value("${app.admin.require-mfa:true}") boolean requireMfa = true;

    public void require(CustomUserDetails me) {
        if (me == null || me.getAuthorities().stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority())))
            throw new AccessDeniedException("Platform administrators only");
        if (requireMfa && !mfa.isEnabled(me.getUserId()))
            throw new AccessDeniedException("Turn on two-factor sign-in before using the admin console");
    }

    public void log(Long adminId, String action, Long chamaId, String detail) {
        jdbc.update("INSERT INTO admin_actions (admin_id, action, chama_id, detail, ip_address) VALUES (?,?,?,?,?)",
                adminId, action, chamaId, detail == null ? null : (detail.length() > 600 ? detail.substring(0, 600) : detail), ClientIp.current());
    }
}
