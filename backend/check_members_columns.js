const pool = require('./config/db');

async function checkColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('Columns in users:', res.rows.map(c => c.column_name));
  } catch (err) {
    console.error('Error checking columns:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkColumns();
