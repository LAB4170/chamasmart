const pool = require('./config/db');

async function testContributionFlow() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        const chamaId = 1;
        const userId = 3; // BOSIRE
        const amount = 500.00;

        console.log("Inserting test contribution...");
        const insertRes = await client.query(`
        INSERT INTO contributions 
        (chama_id, user_id, amount, payment_method, contribution_date, recorded_by, idempotency_key)
        VALUES ($1, $2, $3, 'CASH', NOW(), $2, 'test-key-${Date.now()}')
        RETURNING contribution_id
    `, [chamaId, userId, amount]);

        const contribId = insertRes.rows[0].contribution_id;
        console.log(`Inserted Contribution ID: ${contribId}`);

        console.log("Fetching contributions...");
        const fetchRes = await client.query(`
      SELECT c.contribution_id, c.amount, u.first_name
      FROM contributions c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.chama_id = $1
    `, [chamaId]);

        console.log(`Fetched ${fetchRes.rows.length} contributions`);
        console.log("Data:", fetchRes.rows);

        await client.query('DELETE FROM contributions WHERE contribution_id = $1', [contribId]);
        console.log("Cleaned up test contribution");

        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

testContributionFlow();
