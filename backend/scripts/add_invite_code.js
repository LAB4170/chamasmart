require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Adding invite_code column to chamas table...');

    // Add column
    await client.query(`
      ALTER TABLE chamas 
      ADD COLUMN IF NOT EXISTS invite_code VARCHAR(10) UNIQUE;
    `);

    console.log('Generating codes for existing chamas...');

    // Generate codes for existing chamas
    const res = await client.query('SELECT chama_id FROM chamas WHERE invite_code IS NULL');

    for (const row of res.rows) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await client.query('UPDATE chamas SET invite_code = $1 WHERE chama_id = $2', [code, row.chama_id]);
      console.log(`Updated chama ${row.chama_id} with code ${code}`);
    }

    console.log('✅ Migration successful');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
