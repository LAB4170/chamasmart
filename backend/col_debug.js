const pool = require('./config/db');

async function debug() {
    try {
        console.log("Testing columns one by one...");

        // Test base columns
        try { await pool.query("SELECT cycle_id FROM rosca_cycles LIMIT 1"); console.log("cycle_id OK"); } catch (e) { console.log("cycle_id FAIL:", e.message); }
        try { await pool.query("SELECT chama_id FROM rosca_cycles LIMIT 1"); console.log("chama_id OK"); } catch (e) { console.log("chama_id FAIL:", e.message); }
        try { await pool.query("SELECT cycle_name FROM rosca_cycles LIMIT 1"); console.log("cycle_name OK"); } catch (e) { console.log("cycle_name FAIL:", e.message); }
        try { await pool.query("SELECT contribution_amount FROM rosca_cycles LIMIT 1"); console.log("contribution_amount OK"); } catch (e) { console.log("contribution_amount FAIL:", e.message); }
        try { await pool.query("SELECT frequency FROM rosca_cycles LIMIT 1"); console.log("frequency OK"); } catch (e) { console.log("frequency FAIL:", e.message); }
        try { await pool.query("SELECT start_date FROM rosca_cycles LIMIT 1"); console.log("start_date OK"); } catch (e) { console.log("start_date FAIL:", e.message); }
        try { await pool.query("SELECT status FROM rosca_cycles LIMIT 1"); console.log("status OK"); } catch (e) { console.log("status FAIL:", e.message); }

    } finally {
        await pool.end();
    }
}
debug();
