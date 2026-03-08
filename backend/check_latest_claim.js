const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT * FROM welfare_claims 
      WHERE chama_id = 20 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    console.log('LATEST_CLAIM:', JSON.stringify(res.rows));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
