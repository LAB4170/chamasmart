// inspect_schemas.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_NAME, password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function inspectTable(name) {
  const res = await pool.query(`
    SELECT column_name
    FROM information_schema.columns 
    WHERE table_name = $1
  `, [name]);
  console.log(`${name} columns: ${res.rows.map(r => r.column_name).join(', ')}`);
}

async function main() {
  await inspectTable('assets');
  await inspectTable('asca_share_contributions');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
