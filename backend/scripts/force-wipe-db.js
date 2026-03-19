const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        const dbName = process.env.DB_NAME;
        console.log(`🔄 FORCE WIPE: Terminating other active connections to ${dbName}...`);
        await client.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1
              AND pid <> pg_backend_pid();
        `, [dbName]);

        console.log('🚨 FORCE WIPE: Dropping public schema with CASCADE...');
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        
        console.log('🛠️  FORCE WIPE: Recreating public schema...');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO public');
        await client.query(`GRANT ALL ON SCHEMA public TO ${process.env.DB_USER}`);

        console.log('✅✅✅ FORCE WIPE: DATABASE IS NOW COMPLETELY EMPTY.');

    } catch (err) {
        console.error('❌ FORCE WIPE ERROR:', err.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
