require('dotenv').config();
const p = require('./config/db');

async function checkSchema() {
  try {
    const res = await p.query("SELECT * FROM loans LIMIT 1");
    if (res.rows.length > 0) {
      console.log("Columns in 'loans' table:", Object.keys(res.rows[0]));
    } else {
      const colRes = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'loans'");
      console.log("Columns in 'loans' table (from schema):", colRes.rows.map(r => r.column_name));
    }
  } catch (err) {
    console.error("Error checking schema:", err);
  } finally {
    p.end();
  }
}

checkSchema();
