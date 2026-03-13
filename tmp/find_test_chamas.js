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
    const res = await pool.query(`
      SELECT cm.chama_id, c.chama_name, c.chama_type, u.email, cm.role 
      FROM chama_members cm
      JOIN chamas c ON cm.chama_id = c.chama_id
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')
      ORDER BY chama_id DESC
      LIMIT 10
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
