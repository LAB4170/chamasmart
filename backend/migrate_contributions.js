const pool = require('./config/db');

async function migrateSchema() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        console.log("Adding missing columns to contributions table...");

        await client.query(`
      ALTER TABLE contributions
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
      ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES users(user_id),
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
    `);

        console.log("Migration completed successfully.");

        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Migration Error:", err);
        process.exit(1);
    }
}

migrateSchema();
