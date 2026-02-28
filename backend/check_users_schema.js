const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });
async function run() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('USERS_COLUMNS:' + res.rows.map(r => r.column_name).join(', '));
  } catch(e) { console.log('ERR:' + e.message); } finally { await pool.end(); }
}
run();
