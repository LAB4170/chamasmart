const pool = require('./config/db');

async function checkTable() {
    try {
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'mpesa_transactions' 
                AND column_name = 'cycle_id'
            ) as column_exists
        `);
        console.log('Column cycle_id exists:', res.rows[0].column_exists);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTable();
