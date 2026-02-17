const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:1234@localhost:5432/chamasmart',
});

async function findUser() {
    try {
        await client.connect();
        // Get a user who is a member of chama 1 (assuming it exists)
        const res = await client.query("SELECT user_id, role FROM chama_members WHERE chama_id = 1 LIMIT 1");
        if (res.rows.length > 0) {
            console.log('Found valid user:', res.rows[0]);
        } else {
            console.log('No members found for chama 1. Checking any chama...');
            const anyRes = await client.query("SELECT * FROM chama_members LIMIT 1");
            console.log('Any member:', anyRes.rows[0]);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

findUser();
