const pool = require('./config/db');

async function checkChamas() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'chamas'
    `);
    console.log('Columns in chamas:', res.rows.map(c => c.column_name));
    
    const data = await client.query('SELECT * FROM chamas WHERE chama_id = 1');
    console.log('Chama 1 data:', data.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkChamas();
