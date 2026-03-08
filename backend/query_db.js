const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function checkWelfare(chamaId) {
  try {
    const res1 = await pool.query('SELECT * FROM welfare_fund WHERE chama_id = $1', [chamaId]);
    console.log('welfare_fund balance:', res1.rows[0] ? res1.rows[0].balance : 'NONE');

    const res2 = await pool.query('SELECT status, SUM(amount) FROM welfare_contributions WHERE chama_id = $1 GROUP BY status', [chamaId]);
    console.log('welfare_contributions totals:', res2.rows);

    const res3 = await pool.query('SELECT current_fund, total_welfare_contributions FROM chamas WHERE chama_id = $1', [chamaId]);
    console.log('chamas table record:', res3.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkWelfare(20);
