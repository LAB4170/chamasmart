const pool = require('./config/db');

async function checkChamaSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chamas'
    `);
    const fs = require('fs');
    fs.writeFileSync('chama_columns.json', JSON.stringify(res.rows, null, 2));
    console.log("Written to chama_columns.json");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

checkChamaSchema();
