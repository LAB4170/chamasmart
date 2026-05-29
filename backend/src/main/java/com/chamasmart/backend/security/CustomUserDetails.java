package com.chamasmart.backend.security;
import com.chamasmart.backend.domain.User;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.Collections;
public class CustomUserDetails implements UserDetails {

    private final Long userId;
    private final String email;
    private final String password;
    private final Collection<? extends GrantedAuthority> authorities;
    private final boolean isActive;

    public CustomUserDetails(Long userId, String email, String password, Collection<? extends GrantedAuthority> authorities, boolean isActive) {
        this.userId = userId;
        this.email = email;
        this.password = password;
        this.authorities = authorities;
        this.isActive = isActive;
    }

    public Long getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    public boolean isActive() { return isActive; }
    public static CustomUserDetails build(User user) {
        GrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase());
        return new CustomUserDetails(
                user.getUserId(),
                user.getEmail(),
                user.getPasswordHash(),
                Collections.singletonList(authority),
                user.getIsActive() != null ? user.getIsActive() : true
        );
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }
    @Override
    public boolean isAccountNonLocked() {
        return true;
    }
    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }
    @Override
    public boolean isEnabled() {
        return isActive;
    }
}

