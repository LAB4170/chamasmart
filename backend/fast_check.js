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
  const chamaId = 20;
  try {
    const f = await pool.query('SELECT * FROM welfare_fund WHERE chama_id = $1', [chamaId]);
    console.log('WF_FUND:', JSON.stringify(f.rows));

    const c = await pool.query('SELECT status, amount FROM welfare_contributions WHERE chama_id = $1', [chamaId]);
    console.log('WF_CONTRIBS:', JSON.stringify(c.rows));

    const ch = await pool.query('SELECT current_fund FROM chamas WHERE chama_id = $1', [chamaId]);
    console.log('CHAMA_FUND:', JSON.stringify(ch.rows));
  } catch (e) { console.error(e); }
  finally { pool.end(); }
}
run();
