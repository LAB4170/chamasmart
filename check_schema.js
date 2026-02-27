const pool = require('./backend/config/db');

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, column_default, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chamas' AND column_name = 'is_active'
    `);
    console.log('--- chamas.is_active ---');
    console.table(res.rows);

    const res2 = await pool.query(`
      SELECT column_name, column_default, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chama_members' AND column_name = 'is_active'
    `);
    console.log('--- chama_members.is_active ---');
    console.table(res2.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
