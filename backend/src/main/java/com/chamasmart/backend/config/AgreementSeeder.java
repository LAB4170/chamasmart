package com.chamasmart.backend.config;

import com.chamasmart.backend.service.AgreementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Loads the draft texts of the three agreements the first time the app starts. They stay drafts until an administrator publishes them with counsel's name. */
@Component
@RequiredArgsConstructor
@Slf4j
public class AgreementSeeder implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    private static final Map<String, String> TITLES = Map.of(
            "TERMS_OF_USE", "ChamaSmart Terms of Use",
            "OPERATOR_AGREEMENT", "Chama Operator Agreement (terms and conditions for public listing)",
            "FRAUD_POLICY", "Fraud and Enforcement Policy");

    @Override
    public void run(ApplicationArguments args) {
        for (var e : TITLES.entrySet()) {
            try {
                Integer n = jdbc.queryForObject("SELECT count(*) FROM agreement_versions WHERE code = ?", Integer.class, e.getKey());
                if (n != null && n > 0) continue;
                String body = new String(new ClassPathResource("agreements/" + e.getKey() + ".txt").getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                jdbc.update("INSERT INTO agreement_versions (code, version, title, body, body_hash) VALUES (?,?,?,?,?)", e.getKey(), "0.1-draft", e.getValue(), body, AgreementService.hash(body));
                log.info("Seeded draft agreement {}", e.getKey());
            } catch (Exception ex) {
                log.warn("Could not seed agreement {}: {}", e.getKey(), ex.getMessage());
            }
        }
    }
}
