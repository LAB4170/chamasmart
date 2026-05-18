package com.chamasmart.backend;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@SpringBootApplication
@EnableTransactionManagement
@EnableScheduling
public class ChamaSmartApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChamaSmartApplication.class, args);
    }

    @Bean
    public CommandLineRunner resetSequences(JdbcTemplate jdbcTemplate) {
        return args -> {
            // First, dynamically add missing version columns
            String[] versionTables = {"chamas", "loans", "welfare_fund", "welfare_claims", "asca_cycles"};
            for (String table : versionTables) {
                try {
                    String sql = "ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS version bigint DEFAULT 0";
                    jdbcTemplate.execute(sql);
                    System.out.println("Successfully ensured version column exists on table: " + table);
                } catch (Exception e) {
                    System.out.println("Could not add version column to " + table + ": " + e.getMessage());
                }
            }

            // Ensure meetings table has all required columns
            try {
                jdbcTemplate.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recorded_by bigint");
                jdbcTemplate.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_link text");
                System.out.println("Successfully ensured meetings columns exist");
            } catch (Exception e) {
                System.out.println("Could not ensure meetings columns: " + e.getMessage());
            }

            // Second, reset the serial sequences
            String[] tables = {"users", "chamas", "chama_members", "loans", "contributions", "meetings", "welfare_fund", "welfare_claims", "asca_cycles"};
            String[] idColumns = {"user_id", "chama_id", "membership_id", "loan_id", "contribution_id", "meeting_id", "fund_id", "claim_id", "cycle_id"};
            
            for (int i = 0; i < tables.length; i++) {
                String table = tables[i];
                String idCol = idColumns[i];
                try {
                    String sql = "SELECT setval(pg_get_serial_sequence('" + table + "', '" + idCol + "'), COALESCE(MAX(" + idCol + "), 1)) FROM " + table;
                    jdbcTemplate.execute(sql);
                    System.out.println("Successfully reset sequence for " + table + "." + idCol);
                } catch (Exception e) {
                    System.out.println("Could not reset sequence for " + table + ": " + e.getMessage());
                }
            }
        };
    }

    @Bean
    public CommandLineRunner testScore(com.chamasmart.backend.controller.ChamaController chamaController) {
        return args -> {
            try {
                System.out.println("====== STARTING TEST FOR GET SCORE ======");
                chamaController.getChamaScore(46L);
                System.out.println("====== TEST GET SCORE PASSED SUCCESSFULLY ======");
            } catch (Exception e) {
                System.out.println("====== TEST GET SCORE FAILED ======");
                e.printStackTrace(System.out);
            }
        };
    }
}
