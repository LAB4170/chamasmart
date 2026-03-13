const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_6mY9aNclIsWz@ep-cool-dawn-a5h264st-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
