const pool = require('./config/db');

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'rosca_cycles'
    `);
        console.log("Found rosca_cycles in schemas:", res.rows.map(r => r.table_schema).join(", "));
    } finally {
        await pool.end();
    }
}
checkSchema();
