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

    // Split the SQL into individual statements and execute them one by one
    const statements = sql.split(/;\s*$/m);

    for (const statement of statements) {
      if (statement.trim() !== "") {
        await pool.query(statement);
      }
    }

    logger.info("Migration 010_welfare_module completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Migration 010_welfare_module failed", {
      error: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint,
      file: error.file,
      line: error.line,
      routine: error.routine,
    });

    // Provide helpful error message for common issues
    if (error.code === "42P07") {
      logger.error(
        "One or more tables already exist. If you need to reset the database, drop the existing tables first."
      );
    } else if (error.code === "23505") {
      logger.error(
        "Duplicate key violation. This usually means the migration has already been run."
      );
    } else if (error.code === "23503") {
      logger.error(
        "Foreign key violation. Make sure the referenced tables and records exist."
      );
    }

    process.exit(1);
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
