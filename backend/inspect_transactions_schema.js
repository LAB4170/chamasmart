const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function inspectTransactions() {
  try {
    console.log('\n--- Checking column names for transactions ---');
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'");
    console.log(cols.rows);

    console.log('\n--- Checking transaction_type constraints ---');
    // For ENUM types in Postgres
    const enums = await pool.query(`
        SELECT t.typname AS enum_name, e.enumlabel AS enum_value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        ORDER BY enum_name, enum_value
    `);
    console.log('Enums:', enums.rows);

    // For CHECK constraints
    const checks = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE contype = 'c' AND conrelid = 'transactions'::regclass;
    `);
    console.log('Check constraints:', checks.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

inspectTransactions();
