const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });

async function run() {
  try {
    const userId = 1;
    const result = await pool.query(
      `SELECT jr.*, c.chama_name, c.chama_type, c.description,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM join_requests jr
       JOIN chamas c ON jr.chama_id = c.chama_id
       LEFT JOIN users r ON jr.reviewed_by = r.user_id
       WHERE jr.user_id = $1
       ORDER BY jr.created_at DESC`,
      [userId],
    );
    console.log('MY REQUESTS (User 1):', result.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
