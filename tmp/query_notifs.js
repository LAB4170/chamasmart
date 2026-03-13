
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/chamasmart'
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM notifications WHERE link LIKE '%/chamas/5/%'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
