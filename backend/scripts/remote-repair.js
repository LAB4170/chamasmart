const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgre:SCd9icGjzQfuTTAflpqhDNsWbQjSBIiq@dpg-d6tikmea2pns738rlgu0-a.frankfurt-postgres.render.com/chamasmart_zs0i',
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
    try {
        console.log('🌍 CONNECTING TO REMOTE DATABASE...');
        const client = await pool.connect();
        
        console.log('🚨 RESETTING SCHEMA...');
        await client.query(`
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            GRANT ALL ON SCHEMA public TO public;
            GRANT ALL ON SCHEMA public TO postgre;
        `);
        
        console.log('✅ Status: Public schema recreated remotely!');
        client.release();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Remote repair failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
