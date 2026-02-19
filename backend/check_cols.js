const pool = require('./config/db');

async function checkCols() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rosca_cycles'
    `);
        console.log("Columns in rosca_cycles:", res.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}
checkCols();
