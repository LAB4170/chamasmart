const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log("🔄 Running migration: Add Public/Private Chamas and Join Requests...\n");

        await client.query("BEGIN");

        // 1. Add visibility column to chamas table
        console.log("📝 Adding visibility column to chamas table...");
        await client.query(`
      ALTER TABLE chamas 
      ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PRIVATE' 
      CHECK (visibility IN ('PUBLIC', 'PRIVATE'))
    `);

        // Update existing chamas to PRIVATE
        await client.query(`
      UPDATE chamas SET visibility = 'PRIVATE' WHERE visibility IS NULL
    `);
        console.log("✅ Visibility column added\n");

        // 2. Create join_requests table
        console.log("📝 Creating join_requests table...");
        await client.query(`
      CREATE TABLE IF NOT EXISTS join_requests (
        request_id SERIAL PRIMARY KEY,
        chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        message TEXT,
        reviewed_by INTEGER REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP
      )
    `);

        // Create indexes for join_requests
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_join_requests_chama ON join_requests(chama_id)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status)
    `);
        console.log("✅ join_requests table created\n");

        // 3. Create notifications table
        console.log("📝 Creating notifications table...");
        await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        link VARCHAR(255),
        related_id INTEGER,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Create indexes for notifications
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)
    `);
        console.log("✅ notifications table created\n");

        await client.query("COMMIT");

        console.log("🎉 Migration completed successfully!\n");
        console.log("Summary:");
        console.log("✅ Added visibility column to chamas");
        console.log("✅ Created join_requests table");
        console.log("✅ Created notifications table");
        console.log("✅ Created all indexes");

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Migration failed:", error.message);
        console.error("\nFull error:", error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
