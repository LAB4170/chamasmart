const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const logger = require('../utils/logger');

async function runMigration() {
const migrationFile = path.join(__dirname, '..', 'migrations', '008_table_banking_module.sql');

  try {
    logger.info('Starting database migration: 008_table_banking_module');

    const sql = fs.readFileSync(migrationFile, 'utf8');
    await pool.query(sql);

    logger.info('Migration 008_table_banking_module completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration 008_table_banking_module failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

runMigration();
