const pool = require('./config/db');

async function listTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('--- Tables in chamasmart ---');
    console.table(res.rows.map(r => r.table_name));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listTables();
