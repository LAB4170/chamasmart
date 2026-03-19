const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgre:SCd9icGjzQfuTTAflpqhDNsWbQjSBIiq@dpg-d6tikmea2pns738rlgu0-a.frankfurt-postgres.render.com/chamasmart_zs0i',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables in public schema:', res.rows.map(r => r.table_name));

    const res2 = await pool.query("SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5");
    console.log('Migrations:', res2.rows);
  } catch (e) {
    if (e.code === '42P01') {
      console.log('schema_migrations table does not exist.');
    } else {
      console.error('Error:', e.message);
    }
  } finally {
    pool.end();
  }
}
run();
