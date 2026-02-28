const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });

async function run() {
  try {
    // 1. Elevate user_id 2 to CHAIRPERSON in Chama 1
    const res1 = await pool.query("UPDATE chama_members SET role = 'CHAIRPERSON' WHERE chama_id = 1 AND user_id = 2");
    console.log('Update result for Chama 1:', res1.rowCount);
    
    // 2. Check current state of Chama 1 members
    const members = await pool.query("SELECT * FROM chama_members WHERE chama_id = 1");
    console.log('Current Members:', members.rows);
    
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.end();
  }
}
run();
