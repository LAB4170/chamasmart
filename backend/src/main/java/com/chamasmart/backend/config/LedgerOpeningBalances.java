package com.chamasmart.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Funds that existed before the ledger get one OPENING_BALANCE entry equal to their stored balance, so the journal starts
 * in agreement and every later change is recorded against it. Runs before the server accepts requests, only for funds
 * that have no entries yet.
 */
@Component
@DependsOn({"entityManagerFactory", "legacyBase64Migration"})
@Slf4j
public class LedgerOpeningBalances {
    private final JdbcTemplate jdbc;

    public LedgerOpeningBalances(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @PostConstruct
    void run() {
        int chamaRows = jdbc.update(
                "INSERT INTO ledger_entries (chama_id, account, amount, entry_type, reference_type, memo, created_at) " +
                "SELECT c.chama_id, 'CHAMA_FUND', COALESCE(c.current_fund, 0), 'OPENING_BALANCE', 'SYSTEM', 'Balance when the ledger started', now() " +
                "FROM chamas c WHERE NOT EXISTS (SELECT 1 FROM ledger_entries e WHERE e.chama_id = c.chama_id AND e.account = 'CHAMA_FUND')");
        int welfareRows = jdbc.update(
                "INSERT INTO ledger_entries (chama_id, account, amount, entry_type, reference_type, memo, created_at) " +
                "SELECT w.chama_id, 'WELFARE_FUND', COALESCE(w.balance, 0), 'OPENING_BALANCE', 'SYSTEM', 'Balance when the ledger started', now() " +
                "FROM welfare_fund w WHERE NOT EXISTS (SELECT 1 FROM ledger_entries e WHERE e.chama_id = w.chama_id AND e.account = 'WELFARE_FUND')");
        if (chamaRows + welfareRows > 0) log.info("Ledger: {} opening balance(s) written", chamaRows + welfareRows);
    }
}
