const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });
async function run() {
  try {
    const res = await pool.query("SELECT * FROM notifications LIMIT 0");
    console.log('FIELDS:' + res.fields.map(f => f.name).join(', '));
  } catch(e) { console.log('ERR:' + e.message); } finally { await pool.end(); }
}
run();
