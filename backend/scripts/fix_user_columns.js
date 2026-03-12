const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Running ALTER TABLE commands...');
    await client.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
    await client.query('ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;');
    await client.query('ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;');
    
    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
