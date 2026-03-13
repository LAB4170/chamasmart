const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'chamasmart',
  password: '1234',
  port: 5432,
});

async function run() {
  try {
    const res = await pool.query("SELECT chama_id, chama_name FROM chamas WHERE chama_type = 'ASCA' LIMIT 5");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
