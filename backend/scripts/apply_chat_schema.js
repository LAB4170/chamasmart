const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'migrate_chat.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying chat schema migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Chat schema migration applied successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
