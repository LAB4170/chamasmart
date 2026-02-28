const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });

async function run() {
  try {
    console.log('Testing manual INSERT into join_requests...');
    const res = await pool.query(
      "INSERT INTO join_requests (chama_id, user_id, message, status) VALUES (1, 1, 'Test message', 'PENDING') RETURNING *"
    );
    console.log('INSERT SUCCESS:', res.rows[0]);
    
    const jr = await pool.query("SELECT * FROM join_requests");
    console.log('Current Join Requests Count:', jr.rowCount);
    
    // Check if user 2 is an official and active
    const officialCheck = await pool.query(
      "SELECT user_id, role, is_active FROM chama_members WHERE chama_id = 1 AND role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER')"
    );
    console.log('Officials for Chama 1:', officialCheck.rows);

  } catch (e) {
    console.error('INSERT FAILED:', e.message);
  } finally {
    await pool.end();
  }
}
run();
