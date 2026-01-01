require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkMemberStatus() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT user_id, role, is_active FROM chama_members WHERE chama_id = 1 AND user_id = 2');
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

checkMemberStatus();
