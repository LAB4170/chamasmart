const pool = require("./config/db");

async function resetDatabase() {
    try {
        console.log("🗑️  Wiping all data from database...");

        // Truncate all tables with CASCADE
        await pool.query(`
      TRUNCATE users, chamas, chama_members, contributions, 
      meetings, meeting_attendance, payouts, loans, 
      loan_repayments
      RESTART IDENTITY CASCADE;

    `);

        console.log("✅ All tables truncated successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error wiping database:", error);
        process.exit(1);
    }
}

resetDatabase();
