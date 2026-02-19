const pool = require('./config/db');

async function debug() {
    console.log("--- UNIFIED ROSCA DEBUG ---");
    try {
        // 1. Who am I?
        const who = await pool.query("SELECT current_user, current_database()");
        console.log("Connected as:", who.rows[0].current_user, "to database:", who.rows[0].current_database);

        // 2. What tables are here?
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log("All tables:", tables.rows.map(r => r.table_name).join(", "));

        // 3. Try specifically for rosca_cycles
        const roscaCheck = await pool.query("SELECT * FROM information_schema.tables WHERE table_name = 'rosca_cycles'");
        console.log("Found rosca_cycles in schema search:", roscaCheck.rows.length > 0);

        // 4. Try the insert
        console.log("Attempting Insert...");
        const res = await pool.query(
            `INSERT INTO rosca_cycles (chama_id, cycle_name, contribution_amount, frequency, start_date, status)
       VALUES (1, 'Debug Cycle', 1000, 'WEEKLY', NOW(), 'PENDING')
       RETURNING cycle_id`
        );
        console.log("INSERT SUCCESS! Cycle ID:", res.rows[0].cycle_id);

    } catch (err) {
        console.error("DEBUG ERROR:", err.message);
        console.error("Error Code:", err.code);
    } finally {
        await pool.end();
    }
}

debug();
