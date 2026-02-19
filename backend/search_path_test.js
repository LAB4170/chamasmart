const pool = require('./config/db');

async function debugSearchPath() {
    try {
        const sp = await pool.query("SHOW search_path");
        console.log("Search Path:", sp.rows[0].search_path);

        try {
            const res = await pool.query("SELECT * FROM public.rosca_cycles LIMIT 1");
            console.log("public.rosca_cycles access: SUCCESS");
        } catch (e) {
            console.log("public.rosca_cycles access: FAIL", e.message);
        }
    } finally {
        await pool.end();
    }
}
debugSearchPath();
