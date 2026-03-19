const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgre:SCd9icGjzQfuTTAflpqhDNsWbQjSBIiq@dpg-d6tikmea2pns738rlgu0-a.frankfurt-postgres.render.com/chamasmart_zs0i',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Fetching objects...');
    const viewsRes = await client.query("SELECT table_name FROM information_schema.views WHERE table_schema='public'");
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    
    for (const row of viewsRes.rows) {
      console.log(`Dropping view ${row.table_name}...`);
      await client.query(`DROP VIEW IF EXISTS "${row.table_name}" CASCADE`);
    }

    for (const row of tablesRes.rows) {
      console.log(`Dropping table ${row.table_name}...`);
      await client.query(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`);
    }

    console.log('Checking migrations table again...');
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name='schema_migrations'");
    if (result.rows.length === 0) {
      console.log('✅ Database is now COMPLETELY EMPTY.');
    } else {
      console.log('❌ Failed to drop schema_migrations!');
    }
  } catch (e) {
    console.error('Error:', e.stack);
  } finally {
    client.release();
    pool.end();
  }
}
run();
