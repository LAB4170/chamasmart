const pool = require('./config/db');

async function checkData() {
  const client = await pool.connect();
  try {
    const chamas = await client.query('SELECT chama_id, chama_name FROM chamas LIMIT 5');
    console.log('Chamas in DB:', chamas.rows);

    const users = await client.query('SELECT user_id, email FROM users LIMIT 5');
    console.log('Users in DB:', users.rows);

    const members = await client.query('SELECT chama_id, user_id, role FROM chama_members LIMIT 5');
    console.log('Memberships in DB:', members.rows);
  } catch (err) {
    console.error('Error checking data:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkData();
