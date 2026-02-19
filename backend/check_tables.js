const pool = require('./config/db');

async function check() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log("Tables found:", res.rows.map(r => r.table_name).join(", "));
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}
check();
