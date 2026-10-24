package com.chamasmart.backend.config;

import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Sign-in and sign-up look emails up in lower case. Accounts created before that rule may be stored with capitals and could
 * never match, so this brings them in line once at startup. It does nothing when every email is already lower case, and it
 * skips (and reports) any account whose lower-case form already belongs to another account.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EmailNormalizationRunner implements ApplicationRunner {
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        normalize();
    }

    int normalize() {
        List<User> users = userRepository.findAll();
        Set<String> taken = new HashSet<>();
        for (User u : users) if (u.getEmail() != null) taken.add(u.getEmail());
        int changed = 0;
        for (User u : users) {
            String email = u.getEmail();
            if (email == null) continue;
            String lower = email.trim().toLowerCase(Locale.ROOT);
            if (lower.equals(email)) continue;
            if (taken.contains(lower)) {
                log.warn("Email normalisation skipped for user {}: its lower-case form belongs to another account", u.getUserId());
                continue;
            }
            taken.remove(email);
            taken.add(lower);
            u.setEmail(lower);
            userRepository.save(u);
            changed++;
        }
        if (changed > 0) log.info("Email normalisation: {} account(s) updated to lower case", changed);
        return changed;
    }
}
