const pool = require('./config/db');

async function checkSchema() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'contributions'
    `);

        console.log("Contributions Table Columns:");
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkSchema();
