const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgre:SCd9icGjzQfuTTAflpqhDNsWbQjSBIiq@dpg-d6tikmea2pns738rlgu0-a.frankfurt-postgres.render.com/chamasmart_zs0i',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('--- TABLES ACROSS ALL SCHEMAS ---');
    const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    `);
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('\n--- SEARCHING FOR schema_migrations SPECIFICALLY ---');
    const res2 = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'schema_migrations'
    `);
    console.log(JSON.stringify(res2.rows, null, 2));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}
run();
