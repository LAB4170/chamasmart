const DatabaseUtils = require('./utils/db-utils');
const db = new DatabaseUtils();

async function main() {
    try {
        console.log('🚨 NUCLEAR RESET INITIATED...');
        console.log('This will wipe ALL tables and RESET migrations.');
        
        await db.query(`
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            GRANT ALL ON SCHEMA public TO public;
            -- Grant permissions to the 'postgre' user (Render's default)
            GRANT ALL ON SCHEMA public TO postgre;
        `);
        
        console.log('✅ Status: Public schema recreated and permissions granted.');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Reset failed:', err.message);
        process.exit(1);
    }
}

main();
