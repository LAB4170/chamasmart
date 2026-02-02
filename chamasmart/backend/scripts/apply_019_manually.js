const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function apply() {
    const sqlFile = 'migrations/019_database_recovery_complete.sql';
    console.log(`Reading ${sqlFile}...`);
    const sql = fs.readFileSync(sqlFile, 'utf8');

    const client = await pool.connect();
    try {
        console.log('Applying migration without transaction to find where it fails...');
        // Split by -- SPLIT -- if I had markers, but I don't.
        // I'll just run it as one block first.
        await client.query(sql);
        console.log('✅ Migration applied successfully!');
    } catch (error) {
        console.error('❌ Migration failed!');
        console.error('Error:', error.message);
        if (error.detail) console.error('Detail:', error.detail);
        if (error.where) console.error('Where:', error.where);
    } finally {
        client.release();
        await pool.end();
    }
}

apply();
