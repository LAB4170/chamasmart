const DatabaseUtils = require('./utils/db-utils');
const db = new DatabaseUtils();

async function main() {
    try {
        console.log('🔍 Diagnosing Database State...');
        
        // Check tables
        const tables = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('\n--- Tables Found ---');
        console.log(tables.rows.map(r => r.table_name).join(', ') || '(none)');
        
        // Check migrations
        try {
            const migs = await db.query('SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at DESC');
            console.log('\n--- Applied Migrations ---');
            migs.rows.forEach(m => console.log(`${m.migration_name} (Applied: ${m.applied_at})`));
        } catch (e) {
            console.log('\n--- Migrations Table Missing ---');
        }
        
        // Critical relation check
        const chama_members = await db.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chama_members')");
        console.log(`\nTable 'chama_members' exists: ${chama_members.rows[0].exists}`);
        
        const memberships = await db.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'memberships')");
        console.log(`Table 'memberships' exists: ${memberships.rows[0].exists}`);

        console.log('\n✅ Diagnosis complete.');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Diagnosis failed:', err.message);
        process.exit(1);
    }
}

main();
