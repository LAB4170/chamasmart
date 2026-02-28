const pool = require('./config/db');

async function test() {
  try {
    const meetRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meetings'`);
    console.log("MEETINGS:");
    meetRes.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    
    const userRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`);
    console.log("USERS:");
    userRes.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}
test();
