// deep_inspect.js
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function main() {
  const result = {
    assets: [],
    asca_share_contributions: [],
    asca_members: [],
    chamas: []
  };

  const tables = ['assets', 'asca_share_contributions', 'asca_members', 'chamas'];
  
  for (const table of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
    `, [table]);
    result[table] = res.rows;
  }

  // Also check if chama 19 exists and its type
  const chama = await pool.query('SELECT chama_id, chama_type, is_active FROM chamas WHERE chama_id = 19');
  result.chama19 = chama.rows;

  fs.writeFileSync('deep_inspect_out.json', JSON.stringify(result, null, 2));
  console.log('Inspection complete. Read deep_inspect_out.json');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
