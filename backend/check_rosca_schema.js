const pool = require('./config/db');

async function check() {
  const res = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('rosca_roster', 'transactions', 'chamas', 'chama_members')
    ORDER BY table_name, ordinal_position
  `);
  const grouped = {};
  res.rows.forEach(row => {
    if (!grouped[row.table_name]) grouped[row.table_name] = [];
    grouped[row.table_name].push(row.column_name);
  });
  Object.entries(grouped).forEach(([table, cols]) => {
    console.log(`\n${table}: ${cols.join(', ')}`);
  });
  pool.end();
}
check().catch(e => { console.error(e.message); pool.end(); });
