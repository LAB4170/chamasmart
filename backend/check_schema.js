const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const tables = ['chamas', 'chama_members', 'loans'];
    for (const table of tables) {
      const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`Table: ${table}`);
      console.log(res.rows.map(r => r.column_name).join(', '));
      console.log('---');
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
