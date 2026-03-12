const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'chamasmart',
    password: '1234',
    port: 5432,
});

async function testQuery() {
    const chamaId = 20; // Hardcoded test ID
    try {
        console.log('Testing query for Chama ID:', chamaId);
        const { rows } = await pool.query(
            "SELECT COALESCE(SUM(claim_amount), 0) as total_pending FROM welfare_claims WHERE chama_id = $1 AND status IN ('SUBMITTED','VERIFIED','APPROVED')",
            [chamaId]
        );
        console.log('SUCCESS:', rows[0]);
    } catch (err) {
        console.error('FAILED:', err.message);
        console.error(err.stack);
    } finally {
        await pool.end();
    }
}

testQuery();
