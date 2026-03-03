const pool = require('./config/db');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

async function runMigration() {
  const migrationPath = path.join(__dirname, 'migrations', '031_hybrid_payment_upgrade.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 031_hybrid_payment_upgrade.sql executed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
