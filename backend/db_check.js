const pool = require('./config/db');

async function check() {
    try {
        console.log('--- DB Check ---');
        const tables = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));
        
        const count = await pool.query("SELECT COUNT(*) FROM audit_logs");
        console.log('Audit Logs count:', count.rows[0].count);
        
        const activity = await pool.query("SELECT pid, state, query, wait_event_type, wait_event FROM pg_stat_activity WHERE state != 'idle'");
        console.log('\n--- Active Queries ---');
        activity.rows.forEach(r => {
            console.log(`[${r.pid}] ${r.state} - ${r.wait_event_type || 'none'}/${r.wait_event || 'none'}`);
            console.log(`Query: ${r.query.substring(0, 100)}...`);
            console.log('---');
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

check();
