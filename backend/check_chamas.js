const pool = require('./config/db');

async function checkChamas() {
  try {
    const res = await pool.query('SELECT chama_id, chama_name, chama_type, created_at, is_active FROM chamas');
    console.log(`Total Chamas found: ${res.rows.length}`);
    if (res.rows.length > 0) {
      console.table(res.rows);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkChamas();
