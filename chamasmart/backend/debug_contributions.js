const pool = require('./config/db');

async function checkContributions() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        // Get all contributions
        const res = await client.query('SELECT count(*) FROM contributions');
        console.log("Total contributions:", res.rows[0].count);

        // Get contributions for the first chama found
        const chamaRes = await client.query('SELECT chama_id FROM chamas LIMIT 1');
        if (chamaRes.rows.length > 0) {
            const chamaId = chamaRes.rows[0].chama_id;
            console.log(`Checking contributions for Chama ID: ${chamaId}`);

            const contribRes = await client.query('SELECT * FROM contributions WHERE chama_id = $1', [chamaId]);
            console.log(`Contributions for Chama ${chamaId}:`, contribRes.rows.length);
            if (contribRes.rows.length > 0) {
                console.log("Sample contribution:", contribRes.rows[0]);
            }
        } else {
            console.log("No chamas found");
        }

        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkContributions();
