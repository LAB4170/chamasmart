const pool = require('./config/db');

async function check() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chama_members'
      ORDER BY column_name
    `);
        console.log("--- COLUMNS IN chama_members ---");
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (err) {
        console.error("Check failed:", err.message);
    } finally {
        await pool.end();
    }
}

check();
