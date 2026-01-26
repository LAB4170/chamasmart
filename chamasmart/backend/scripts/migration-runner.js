/**
 * Unified Migration Runner
 * Consolidates all migration scripts into one robust solution
 *
 * Usage:
 *   node scripts/migration-runner.js <migration-file>
 *   node scripts/migration-runner.js migrations/010_welfare_module.sql
 *   node scripts/migration-runner.js --list
 *   node scripts/migration-runner.js --status
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const DatabaseUtils = require("./utils/db-utils");
const logger = require("../utils/logger");

const db = new DatabaseUtils();

// Migration tracking table
const MIGRATION_TABLE = "schema_migrations";

/**
 * Create migration tracking table
 */
async function ensureMigrationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT TRUE,
      error_message TEXT
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_migration_name 
    ON ${MIGRATION_TABLE}(migration_name)
  `);
}

/**
 * Check if migration has been applied
 */
async function isMigrationApplied(migrationName) {
  const result = await db.query(
    `SELECT EXISTS(SELECT 1 FROM ${MIGRATION_TABLE} WHERE migration_name = $1 AND success = TRUE)`,
    [migrationName],
  );
  return result.rows[0].exists;
}

/**
 * Record migration execution
 */
async function recordMigration(
  migrationName,
  executionTimeMs,
  success,
  errorMessage = null,
) {
  await db.query(
    `INSERT INTO ${MIGRATION_TABLE} 
     (migration_name, execution_time_ms, success, error_message) 
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (migration_name) DO UPDATE 
     SET executed_at = CURRENT_TIMESTAMP, 
         execution_time_ms = $2, 
         success = $3, 
         error_message = $4`,
    [migrationName, executionTimeMs, success, errorMessage],
  );
}

/**
 * Get list of migration files
 */
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, "..", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    logger.warn(`Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/**
 * Execute a migration file
 */
async function executeMigration(migrationFile) {
  const migrationPath = path.join(__dirname, "..", "migrations", migrationFile);
  const migrationName = path.basename(migrationFile, ".sql");

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🔄 Running migration: ${migrationName}`);
  console.log("=".repeat(70));

  // Check if already applied
  const alreadyApplied = await isMigrationApplied(migrationName);
  if (alreadyApplied) {
    console.log(`⏭️  Migration already applied, skipping...`);
    return { skipped: true };
  }

  // Read SQL file
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, "utf8");

  if (!sql.trim()) {
    throw new Error("Migration file is empty");
  }

  // Execute migration
  const startTime = Date.now();

  try {
    await db.transaction(async (client) => {
      await client.query(sql);
    });

    const executionTime = Date.now() - startTime;

    // Record success
    await recordMigration(migrationName, executionTime, true);

    console.log(`✅ Migration completed successfully in ${executionTime}ms`);

    logger.info(`Migration ${migrationName} completed`, {
      executionTime,
      migrationFile,
    });

    return { success: true, executionTime };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    // Handle "already exists" errors gracefully
    if (error.code === "42P07" || error.message.includes("already exists")) {
      console.log(`⚠️  Some objects already exist, marking as successful...`);
      await recordMigration(
        migrationName,
        executionTime,
        true,
        "Objects already existed",
      );
      return { success: true, executionTime, warning: true };
    }

    // Record failure
    await recordMigration(migrationName, executionTime, false, error.message);

    logger.error(`Migration ${migrationName} failed`, {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });

    throw error;
  }
}

/**
 * List all migrations and their status
 */
async function listMigrations() {
  console.log("\n📋 Migration Status\n");
  console.log("=".repeat(70));

  const files = getMigrationFiles();

  if (files.length === 0) {
    console.log("No migration files found");
    return;
  }

  for (const file of files) {
    const migrationName = path.basename(file, ".sql");
    const applied = await isMigrationApplied(migrationName);

    const status = applied ? "✅ Applied" : "⏳ Pending";
    console.log(`${status.padEnd(12)} ${migrationName}`);
  }

  console.log("=".repeat(70) + "\n");
}

/**
 * Show migration history
 */
async function showMigrationHistory() {
  console.log("\n📜 Migration History\n");
  console.log("=".repeat(70));

  const result = await db.query(
    `SELECT migration_name, executed_at, execution_time_ms, success, error_message
     FROM ${MIGRATION_TABLE}
     ORDER BY executed_at DESC
     LIMIT 20`,
  );

  if (result.rows.length === 0) {
    console.log("No migrations executed yet");
  } else {
    result.rows.forEach((row) => {
      const status = row.success ? "✅" : "❌";
      const time = row.execution_time_ms ? `${row.execution_time_ms}ms` : "N/A";
      const date = new Date(row.executed_at).toLocaleString();

      console.log(`${status} ${row.migration_name}`);
      console.log(`   Executed: ${date} (${time})`);

      if (row.error_message) {
        console.log(`   Error: ${row.error_message}`);
      }
      console.log("");
    });
  }

  console.log("=".repeat(70) + "\n");
}

/**
 * Main execution
 */
async function main() {
  try {
    const args = process.argv.slice(2);

    // Ensure migration tracking table exists
    await ensureMigrationTable();

    // Handle commands
    if (args.includes("--help")) {
      console.log(`
Migration Runner - Unified database migration tool

Usage:
  node scripts/migration-runner.js <migration-file>
  node scripts/migration-runner.js [options]

Options:
  --list      List all migrations and their status
  --status    Show migration execution history
  --all       Run all pending migrations
  --help      Show this help message

Examples:
  node scripts/migration-runner.js migrations/010_welfare_module.sql
  node scripts/migration-runner.js 010_welfare_module.sql
  node scripts/migration-runner.js --list
  node scripts/migration-runner.js --all
      `);
      process.exit(0);
    }

    if (args.includes("--list")) {
      await listMigrations();
      process.exit(0);
    }

    if (args.includes("--status")) {
      await showMigrationHistory();
      process.exit(0);
    }

    if (args.includes("--all")) {
      console.log("🚀 Running all pending migrations...\n");
      const files = getMigrationFiles();
      let applied = 0;
      let skipped = 0;

      for (const file of files) {
        const result = await executeMigration(file);
        if (result.skipped) {
          skipped++;
        } else if (result.success) {
          applied++;
        }
      }

      console.log(`\n✨ Migration batch complete!`);
      console.log(`   Applied: ${applied}`);
      console.log(`   Skipped: ${skipped}`);
      console.log(`   Total: ${files.length}\n`);
      process.exit(0);
    }

    // Run specific migration
    if (args.length === 0) {
      console.error("❌ Please specify a migration file or use --help");
      process.exit(1);
    }

    const migrationArg = args[0];
    const migrationFile = migrationArg.includes("/")
      ? path.basename(migrationArg)
      : migrationArg.endsWith(".sql")
        ? migrationArg
        : `${migrationArg}.sql`;

    await executeMigration(migrationFile);
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);

    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }

    if (error.code === "23503") {
      console.error(
        "   💡 Foreign key violation - ensure referenced tables/records exist",
      );
    }

    logger.error("Migration execution failed", {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });

    process.exit(1);
  } finally {
    await db.close();
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception during migration", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection during migration", {
    reason: reason instanceof Error ? reason.message : reason,
  });
  process.exit(1);
});

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { executeMigration, listMigrations };
