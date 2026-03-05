// find_asca_tables.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%asca%'")
  .then(res => {
    console.log('--- ASCA TABLES ---');
    if (res.rows.length === 0) {
        console.log('NO TABLES FOUND WITH "asca" IN THE NAME');
    } else {
        res.rows.forEach(r => console.log(r.table_name));
    }
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
