const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:1234@localhost:5432/chamasmart',
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Running migration...');

        // Add meeting_link column
        await client.query("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_link TEXT;");
        console.log('Added meeting_link column.');

        // Verify
        const res = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'meetings'"
        );
        console.log('Updated columns:', res.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
