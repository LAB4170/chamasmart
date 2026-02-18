const pool = require('./config/db');

async function repro() {
    const chamaId = 1;
    const userId = 2;
    const newRole = 'TREASURER';

    console.log(`Testing role update: chamaId=${chamaId}, userId=${userId}, newRole=${newRole}`);

    const client = await pool.connect();
    try {
        // 1. Check member
        console.log("Step 1: Checking member...");
        const memberCheck = await client.query(
            "SELECT user_id, role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
            [chamaId, userId]
        );
        console.log("Member found:", memberCheck.rows);

        if (memberCheck.rows.length === 0) {
            console.log("Member NOT found or inactive. Proceeding anyway to see if update fails...");
        }

        // 2. Update role
        console.log("Step 2: Updating role...");
        await client.query("BEGIN");
        const result = await client.query(
            `UPDATE chama_members 
       SET role = $1, updated_at = NOW()
       WHERE chama_id = $2 AND user_id = $3
       RETURNING *`,
            [newRole, chamaId, userId]
        );
        console.log("Update result:", result.rows);
        await client.query("COMMIT");
        console.log("SUCCESS: Transaction committed.");
    } catch (err) {
        console.error("FAILURE:", err.message);
        if (err.stack) console.error(err.stack);
        await client.query("ROLLBACK").catch(() => { });
    } finally {
        client.release();
        pool.end();
    }
}

repro();
