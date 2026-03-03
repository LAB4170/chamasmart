const pool = require('./config/db');

async function checkIsActive() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT user_id, chama_id, role, is_active FROM chama_members
    `);
    console.log('Member activation status:', res.rows);
  } catch (err) {
    console.error('Error checking active status:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkIsActive();
