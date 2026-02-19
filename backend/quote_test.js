const pool = require('./config/db');

async function debug() {
    try {
        console.log("Testing quoted frequency...");
        const res = await pool.query('SELECT "frequency" FROM rosca_cycles LIMIT 1');
        console.log("Quoted frequency OK");
    } catch (e) {
        console.log("Quoted frequency FAIL:", e.message);
    } finally {
        await pool.end();
    }
}
debug();
