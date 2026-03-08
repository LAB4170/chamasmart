const pool = require('./config/db');
const fs = require('fs');

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, is_nullable, column_default, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('rosca_cycles', 'rosca_roster', 'rosca_swap_requests')
      ORDER BY table_name, ordinal_position
    `);
    fs.writeFileSync('rosca_schema_final.json', JSON.stringify(result.rows, null, 2));
    console.log('✅ Schema written to rosca_schema_final.json');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
