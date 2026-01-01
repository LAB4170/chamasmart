require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chamas';
    `);
        console.log("Columns in 'chamas' table:");
        res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
