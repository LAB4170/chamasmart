const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function inspectSchema() {
  const tables = ['chamas', 'chama_members', 'contributions', 'loans', 'loan_repayments'];
  try {
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default, is_generated, generation_expression 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      console.log(`\n--- Table: ${table} ---`);
      console.table(res.rows);
    }
  } catch (err) {
    console.error('Error inspecting schema:', err);
  } finally {
    await pool.end();
  }
}

inspectSchema();
