const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:1234@localhost:5432/chamasmart',
});

async function debugCheckMember() {
    try {
        await client.connect();
        console.log('Connected to DB');

        const chamaId = 1;
        const userId = 3; // From previous step

        console.log(`Checking member: chamaId=${chamaId}, userId=${userId}`);

        // Simulate checkChamaMember
        const result = await client.query(
            `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
            [chamaId, userId]
        );

        if (result.rows.length === 0) {
            console.error("Not a member of this chama");
        } else {
            console.log("Member check PASSED");
        }

        // Now simulate the getChamaMeetings query again, just to be sure
        const params = [chamaId, 20, 0];
        const countQuery = `SELECT COUNT(*) as count FROM meetings m WHERE m.chama_id = $1`;
        const countResult = await client.query(countQuery, [chamaId]);
        console.log("Count result:", countResult.rows[0]);

    } catch (err) {
        console.error('DEBUG ERROR:', err);
    } finally {
        await client.end();
    }
}

debugCheckMember();
