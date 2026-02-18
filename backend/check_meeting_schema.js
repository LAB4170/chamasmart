const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:1234@localhost:5432/chamasmart',
});

async function checkSchema() {
    try {
        await client.connect();
        const res = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'meetings'"
        );
        console.log('Columns in meetings table:', res.rows.map(r => r.column_name));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
