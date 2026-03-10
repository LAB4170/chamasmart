const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function listTables() {
  const arg = process.argv[2];
  const client = await pool.connect();
  try {
    if (arg && arg.toUpperCase().startsWith('SELECT')) {
      const res = await client.query(arg);
      console.log('Query Result:');
      console.table(res.rows);
      return;
    }

    if (!arg) {
      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log('Tables in database:');
      res.rows.forEach(row => console.log(`- ${row.table_name}`));
    }

    const tableToExplore = arg || 'rosca'; // default if none provided
    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE $1
    `, [`%${tableToExplore}%`]);

    for (const table of resTables.rows) {
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table.table_name}'
        `);
        console.log(`\nColumns for ${table.table_name}:`);
        columns.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

listTables();
