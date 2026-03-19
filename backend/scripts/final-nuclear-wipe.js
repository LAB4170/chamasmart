const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgre:SCd9icGjzQfuTTAflpqhDNsWbQjSBIiq@dpg-d6tikmea2pns738rlgu0-a.frankfurt-postgres.render.com/chamasmart_zs0i',
  ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('🔄 Terminating other active connections...');
        await client.query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = 'chamasmart_zs0i'
              AND pid <> pg_backend_pid();
        `);

        console.log('🚨 Dropping public schema with CASCADE...');
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        
        console.log('🛠️ Recreating public schema...');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO public');
        await client.query('GRANT ALL ON SCHEMA public TO postgre');

        console.log('🔍 Final Verification...');
        const res = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'");
        const count = parseInt(res.rows[0].count);
        
        if (count === 0) {
            console.log('✅✅✅ DATABASE IS NOW TRULY, FINALLY EMPTY.');
        } else {
            console.log(`⚠️  Warning: Still found ${count} tables!`);
        }

    } catch (err) {
        console.error('❌ FATAL ERROR DURING WIPE:', err.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
