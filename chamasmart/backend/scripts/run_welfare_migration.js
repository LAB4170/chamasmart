const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const logger = require("../utils/logger");

async function runMigration() {
  const migrationFile = path.join(
    __dirname,
    "..",
    "migrations",
    "010_welfare_module.sql"
  );

  try {
    logger.info("Starting database migration: 010_welfare_module");

    // Read the SQL file
    const sql = fs.readFileSync(migrationFile, "utf8");

    // Execute the entire SQL file at once
    // This properly handles dollar-quoted strings and multi-line functions
    await pool.query(sql);

    logger.info("Migration 010_welfare_module completed successfully");
    process.exit(0);
  } catch (error) {
    // Check if error is due to objects already existing
    // Postgres error 42P07 is "relation already exists", 23505 is "unique violation"
    if (
      error.message.includes("already exists") ||
      error.code === "42P07" ||
      error.code === "23505"
    ) {
      logger.warn("Some database objects already exist, skipping...");
      logger.info("Migration completed with warnings");
      process.exit(0);
    } else {
      logger.error("Migration 010_welfare_module failed", {
        error: error.message,
        stack: error.stack,
        code: error.code,
      });

      // Provide helpful error message for common issues
      if (error.code === "23503") {
        logger.error(
          "Foreign key violation. Make sure the referenced tables and records exist."
        );
      }

      process.exit(1);
    }
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception during migration", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection during migration", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

// Run the migration
runMigration();
