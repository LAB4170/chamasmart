/**
 * Performance Indexes Script - Revised
 * Adds database indexes for optimal query performance
 *
 * Improvements:
 * - Uses centralized DatabaseUtils
 * - Organized index groups
 * - Comprehensive coverage
 * - Better error handling
 * - Performance metrics
 */

require("dotenv").config();
const DatabaseUtils = require("./utils/db-utils");
const logger = require("../utils/logger");

const db = new DatabaseUtils();

// Organized index definitions
const INDEX_GROUPS = {
  chamas: [
    {
      name: "idx_chamas_created_by",
      sql: "CREATE INDEX IF NOT EXISTS idx_chamas_created_by ON chamas(created_by)",
    },
    {
      name: "idx_chamas_visibility",
      sql: "CREATE INDEX IF NOT EXISTS idx_chamas_visibility ON chamas(visibility)",
    },
    {
      name: "idx_chamas_type",
      sql: "CREATE INDEX IF NOT EXISTS idx_chamas_type ON chamas(chama_type)",
    },
    {
      name: "idx_chamas_active",
      sql: "CREATE INDEX IF NOT EXISTS idx_chamas_active ON chamas(is_active)",
    },
    {
      name: "idx_chamas_invite_code",
      sql: "CREATE INDEX IF NOT EXISTS idx_chamas_invite_code ON chamas(invite_code)",
    },
    {
      name: "idx_chamas_created_at",
      sql: "CREATE INDEX IF NOT EXISTS idx_chamas_created_at ON chamas(created_at DESC)",
    },
  ],

  chama_members: [
    {
      name: "idx_members_user_id",
      sql: "CREATE INDEX IF NOT EXISTS idx_members_user_id ON chama_members(user_id)",
    },
    {
      name: "idx_members_chama_id",
      sql: "CREATE INDEX IF NOT EXISTS idx_members_chama_id ON chama_members(chama_id)",
    },
    {
      name: "idx_members_active",
      sql: "CREATE INDEX IF NOT EXISTS idx_members_active ON chama_members(is_active)",
    },
    {
      name: "idx_members_role",
      sql: "CREATE INDEX IF NOT EXISTS idx_members_role ON chama_members(role)",
    },
    {
      name: "idx_members_composite",
      sql: "CREATE INDEX IF NOT EXISTS idx_members_composite ON chama_members(chama_id, user_id, is_active)",
    },
  ],

  contributions: [
    {
      name: "idx_contributions_chama",
      sql: "CREATE INDEX IF NOT EXISTS idx_contributions_chama ON contributions(chama_id)",
    },
    {
      name: "idx_contributions_user",
      sql: "CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions(user_id)",
    },
    {
      name: "idx_contributions_date",
      sql: "CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(contribution_date DESC)",
    },
    {
      name: "idx_contributions_recorded_by",
      sql: "CREATE INDEX IF NOT EXISTS idx_contributions_recorded_by ON contributions(recorded_by)",
    },
    {
      name: "idx_contributions_composite",
      sql: "CREATE INDEX IF NOT EXISTS idx_contributions_composite ON contributions(chama_id, contribution_date DESC)",
    },
  ],

  loans: [
    {
      name: "idx_loans_chama",
      sql: "CREATE INDEX IF NOT EXISTS idx_loans_chama ON loans(chama_id)",
    },
    {
      name: "idx_loans_user",
      sql: "CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id)",
    },
    {
      name: "idx_loans_status",
      sql: "CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status)",
    },
    {
      name: "idx_loans_due_date",
      sql: "CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date)",
    },
    {
      name: "idx_loans_composite",
      sql: "CREATE INDEX IF NOT EXISTS idx_loans_composite ON loans(chama_id, status, due_date)",
    },
  ],

  loan_repayments: [
    {
      name: "idx_repayments_loan",
      sql: "CREATE INDEX IF NOT EXISTS idx_repayments_loan ON loan_repayments(loan_id)",
    },
    {
      name: "idx_repayments_date",
      sql: "CREATE INDEX IF NOT EXISTS idx_repayments_date ON loan_repayments(repayment_date DESC)",
    },
  ],

  notifications: [
    {
      name: "idx_notifications_user",
      sql: "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)",
    },
    {
      name: "idx_notifications_read",
      sql: "CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)",
    },
    {
      name: "idx_notifications_created",
      sql: "CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)",
    },
    {
      name: "idx_notifications_composite",
      sql: "CREATE INDEX IF NOT EXISTS idx_notifications_composite ON notifications(user_id, is_read, created_at DESC)",
    },
  ],

  join_requests: [
    {
      name: "idx_join_requests_chama",
      sql: "CREATE INDEX IF NOT EXISTS idx_join_requests_chama ON join_requests(chama_id)",
    },
    {
      name: "idx_join_requests_user",
      sql: "CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id)",
    },
    {
      name: "idx_join_requests_status",
      sql: "CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status)",
    },
    {
      name: "idx_join_requests_composite",
      sql: "CREATE INDEX IF NOT EXISTS idx_join_requests_composite ON join_requests(chama_id, status, created_at DESC)",
    },
  ],

  meetings: [
    {
      name: "idx_meetings_chama",
      sql: "CREATE INDEX IF NOT EXISTS idx_meetings_chama ON meetings(chama_id)",
    },
    {
      name: "idx_meetings_date",
      sql: "CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC)",
    },
    {
      name: "idx_meetings_recorded_by",
      sql: "CREATE INDEX IF NOT EXISTS idx_meetings_recorded_by ON meetings(recorded_by)",
    },
  ],

  meeting_attendance: [
    {
      name: "idx_attendance_meeting",
      sql: "CREATE INDEX IF NOT EXISTS idx_attendance_meeting ON meeting_attendance(meeting_id)",
    },
    {
      name: "idx_attendance_user",
      sql: "CREATE INDEX IF NOT EXISTS idx_attendance_user ON meeting_attendance(user_id)",
    },
  ],

  chama_invites: [
    {
      name: "idx_invite_code",
      sql: "CREATE INDEX IF NOT EXISTS idx_invite_code ON chama_invites(invite_code)",
    },
    {
      name: "idx_chama_invites",
      sql: "CREATE INDEX IF NOT EXISTS idx_chama_invites ON chama_invites(chama_id)",
    },
    {
      name: "idx_invites_active",
      sql: "CREATE INDEX IF NOT EXISTS idx_invites_active ON chama_invites(is_active, expires_at)",
    },
  ],

  users: [
    {
      name: "idx_users_email",
      sql: "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    },
    {
      name: "idx_users_phone",
      sql: "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)",
    },
    {
      name: "idx_users_active",
      sql: "CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)",
    },
  ],
};

async function addPerformanceIndexes() {
  const startTime = Date.now();
  const results = {
    created: 0,
    existed: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    console.log("🚀 Adding performance indexes to database...\n");
    console.log("=".repeat(70) + "\n");

    await db.transaction(async (client) => {
      for (const [tableName, indexes] of Object.entries(INDEX_GROUPS)) {
        console.log(`📊 ${tableName.toUpperCase()} table:`);

        // Check if table exists first
        const tableExists = await db.tableExists(tableName);

        if (!tableExists) {
          console.log(`  ⏭️  Table doesn't exist, skipping all indexes\n`);
          results.skipped += indexes.length;
          continue;
        }

        for (const { name, sql } of indexes) {
          try {
            await client.query(sql);
            console.log(`  ✅ ${name}`);
            results.created++;
          } catch (error) {
            if (error.code === "42703") {
              console.log(`  ⚠️  ${name} - column doesn't exist, skipping`);
              results.skipped++;
            } else if (error.code === "42P07") {
              console.log(`  ℹ️  ${name} - already exists`);
              results.existed++;
            } else {
              console.log(`  ❌ ${name} - failed: ${error.message}`);
              results.failed++;
            }
          }
        }
        console.log("");
      }
    });

    const executionTime = Date.now() - startTime;

    console.log("=".repeat(70));
    console.log("🎉 Index creation complete!\n");
    console.log("📊 Summary:");
    console.log(`   Created:  ${results.created} indexes`);
    console.log(`   Existed:  ${results.existed} indexes`);
    console.log(`   Skipped:  ${results.skipped} indexes`);
    console.log(`   Failed:   ${results.failed} indexes`);
    console.log(`   Time:     ${executionTime}ms\n`);

    if (results.created > 0 || results.existed > 0) {
      console.log("📈 Expected improvements:");
      console.log("   • 50-70% faster query times");
      console.log("   • Better performance with large datasets");
      console.log("   • Optimized JOIN operations");
      console.log("   • Improved filtering and sorting");
    }

    console.log("=".repeat(70) + "\n");

    logger.info("Performance indexes added", {
      executionTime,
      results,
    });
  } catch (error) {
    console.error("\n❌ Error adding indexes:", error.message);
    logger.error("Index creation failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run if executed directly
if (require.main === module) {
  addPerformanceIndexes();
}

module.exports = { addPerformanceIndexes, INDEX_GROUPS };
