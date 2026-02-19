const pool = require('./config/db');

async function checkCols() {
    try {
        const res = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'rosca_cycles'
    `);
        console.log("Columns (quoted):", res.rows.map(r => `"${r.column_name}"`).join(", "));
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}
checkCols();
