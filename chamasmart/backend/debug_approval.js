require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function debugJoinRequest(requestId) {
    const client = await pool.connect();
    try {
        console.log(`--- Debugging Join Request ${requestId} ---`);

        // 1. Get Join Request Details
        const reqRes = await client.query('SELECT * FROM join_requests WHERE request_id = $1', [requestId]);
        if (reqRes.rows.length === 0) {
            console.log('Join Request not found.');
            return;
        }
        const request = reqRes.rows[0];
        console.log('Request Details:', request);
        const chamaId = request.chama_id;

        // 2. Get Chama Details
        const chamaRes = await client.query('SELECT chama_name, created_by FROM chamas WHERE chama_id = $1', [chamaId]);
        console.log('Chama Details:', chamaRes.rows[0]);

        // 3. List Officials for this Chama
        const officialsRes = await client.query(`
        SELECT u.user_id, u.first_name, u.last_name, cm.role 
        FROM chama_members cm
        JOIN users u ON cm.user_id = u.user_id
        WHERE cm.chama_id = $1 AND cm.role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER')
    `, [chamaId]);

        console.log('Officials for this Chama:');
        officialsRes.rows.forEach(o => console.log(`- [${o.user_id}] ${o.first_name} ${o.last_name} (${o.role})`));

        // 4. List ALL members to be sure
        const allMembers = await client.query(`
        SELECT u.user_id, u.first_name, u.last_name, cm.role 
        FROM chama_members cm
        JOIN users u ON cm.user_id = u.user_id
        WHERE cm.chama_id = $1
    `, [chamaId]);
        console.log('All Members:');
        allMembers.rows.forEach(m => console.log(`- [${m.user_id}] ${m.first_name} ${m.last_name} (${m.role})`));

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

// Run for Request ID 1 (from screenshot)
debugJoinRequest(1);
