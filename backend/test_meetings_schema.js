const pool = require('./config/db');
async function test() {
  const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%meeting%'");
  console.log("Tables containing 'meeting':", result.rows);
  pool.end();
}
test();
