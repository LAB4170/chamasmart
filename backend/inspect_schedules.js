const pool = require('./config/db');
async function run() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'loan_schedules' ORDER BY ordinal_position");
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
