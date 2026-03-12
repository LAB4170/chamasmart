const db = require('./config/db');
require('dotenv').config();

async function testWrapper() {
    const chamaId = 20;
    try {
        console.log('Testing db.query wrapper with params:', [chamaId]);
        const result = await db.query(
            "SELECT balance FROM welfare_fund WHERE chama_id = $1", 
            [chamaId]
        );
        console.log('SUCCESS:', result.rows[0] || 'No rows found');
    } catch (err) {
        console.error('FAILED!', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await db.end();
    }
}

testWrapper();
