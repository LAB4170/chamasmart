/**
 * Cleanup Script: Delete all user accounts and reset chama data
 * Usage: node scripts/cleanup_users.js
 *
 * This script:
 * 1. Deletes all users (cascades to all related data)
 * 2. Resets all chama data
 * 3. Resets all contribution data
 * 4. Logs all deletions
 */

require("dotenv").config();
const pool = require("../config/db");
const logger = require("../utils/logger");

// Helper function to safely execute delete queries without transaction
async function safeDelete(pool, tableName) {
  try {
    const result = await pool.query(`DELETE FROM ${tableName}`);
    console.log(`✅ Deleted ${result.rowCount} rows from ${tableName}`);
    return result.rowCount;
  } catch (e) {
    if (e.message.includes("does not exist") || e.message.includes("ENOENT")) {
      console.log(`⏭️  Table ${tableName} does not exist, skipping`);
    } else {
      console.warn(`⚠️  Could not delete from ${tableName}: ${e.message}`);
    }
    return 0;
  }
}

// Helper function to reset a sequence
async function resetSequence(pool, sequenceName) {
  try {
    await pool.query(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`);
    return true;
  } catch (e) {
    // Sequence might not exist
    return false;
  }
}

async function cleanupUsers() {
  try {
    console.log("🧹 Starting cleanup...\n");

    // 1. Get count of existing users (without transaction)
    try {
      const userCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM users"
      );
      const userCount = userCountResult.rows[0].count;
      console.log(`📊 Found ${userCount} users to delete`);
    } catch (e) {
      console.warn("⚠️  Could not count users");
    }

    // 2. Get count of existing chamas
    try {
      const chamaCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM chamas"
      );
      const chamaCount = chamaCountResult.rows[0].count;
      console.log(`📊 Found ${chamaCount} chamas`);
    } catch (e) {
      console.warn("⚠️  Could not count chamas");
    }

    // 3. Get count of contributions
    try {
      const contribCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM contributions"
      );
      const contribCount = contribCountResult.rows[0].count;
      console.log(`📊 Found ${contribCount} contributions\n`);
    } catch (e) {
      console.warn("⚠️  Could not count contributions");
    }

    console.log("🗑️  Deleting data in safe order...\n");

    // Delete in order of foreign key dependencies (leaf tables first)
    // This is NON-TRANSACTIONAL so each delete is independent

    // Welfare module
    await safeDelete(pool, "welfare_claim_approvals");
    await safeDelete(pool, "welfare_claims");
    await safeDelete(pool, "welfare_contributions");

    // Loans
    await safeDelete(pool, "loan_repayments");
    await safeDelete(pool, "loans");

    // Payouts
    await safeDelete(pool, "payouts");

    // ROSCA (alternative savings)
    await safeDelete(pool, "rosca_payouts");
    await safeDelete(pool, "rosca_members");

    // ASCA (another variant)
    await safeDelete(pool, "asca_cycles");
    await safeDelete(pool, "asca_members");

    // Core operations
    await safeDelete(pool, "meetings");
    await safeDelete(pool, "contributions");
    await safeDelete(pool, "proposals");

    // Notifications & logs
    await safeDelete(pool, "audit_logs");
    await safeDelete(pool, "notifications");

    // Memberships
    await safeDelete(pool, "join_requests");
    await safeDelete(pool, "chama_invites");
    await safeDelete(pool, "chama_members");

    // Parent tables (delete chamas before users due to FK)
    await safeDelete(pool, "chamas");

    // Finally, delete all users
    await safeDelete(pool, "users");

    // Reset sequences
    console.log("\n🔄 Resetting ID sequences...");
    const sequences = [
      "users_user_id_seq",
      "chamas_chama_id_seq",
      "contributions_contribution_id_seq",
      "meetings_meeting_id_seq",
      "loans_loan_id_seq",
      "notifications_notification_id_seq",
    ];

    let resetCount = 0;
    for (const seq of sequences) {
      if (await resetSequence(pool, seq)) {
        resetCount++;
      }
    }
    console.log(`✅ Reset ${resetCount} ID sequences`);

    console.log("\n✨ Cleanup completed successfully!");
    console.log("📝 Database is now ready for fresh user registration.\n");

    logger.info("User cleanup completed", {
      timestamp: new Date().toISOString(),
      message: "All users and related data deleted successfully",
    });
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error.message);
    console.error(
      "💡 Tip: Make sure database connection is working and you have proper permissions."
    );
    logger.error("User cleanup failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
    pool.end();
  }
}

// Run the cleanup
cleanupUsers();
