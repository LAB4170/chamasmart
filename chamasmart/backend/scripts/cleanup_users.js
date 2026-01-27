/**
 * Cleanup Script: Delete all user accounts and reset chama data
 * Usage: node scripts/cleanup-users.js [--force]
 *
 * Improvements:
 * - Uses centralized DatabaseUtils
 * - Adds confirmation prompts
 * - Better error handling
 * - Audit logging
 * - Dry-run mode
 */

require('dotenv').config();
const readline = require('readline');
const DatabaseUtils = require('./utils/db-utils');
const logger = require('../utils/logger');

const db = new DatabaseUtils();

// Tables in order of foreign key dependencies (leaf tables first)
const DELETION_ORDER = [
  // Welfare module
  { name: 'welfare_claim_approvals', description: 'Welfare claim approvals' },
  { name: 'welfare_claims', description: 'Welfare claims' },
  { name: 'welfare_contributions', description: 'Welfare contributions' },

  // Loans
  { name: 'loan_repayments', description: 'Loan repayments' },
  { name: 'loans', description: 'Loans' },

  // Payouts
  { name: 'payouts', description: 'Payouts' },

  // ROSCA/ASCA
  { name: 'rosca_payouts', description: 'ROSCA payouts' },
  { name: 'rosca_members', description: 'ROSCA members' },
  { name: 'asca_cycles', description: 'ASCA cycles' },
  { name: 'asca_members', description: 'ASCA members' },

  // Core operations
  { name: 'meeting_attendance', description: 'Meeting attendance' },
  { name: 'meetings', description: 'Meetings' },
  { name: 'contributions', description: 'Contributions' },
  { name: 'proposals', description: 'Proposals' },

  // Notifications & logs
  { name: 'audit_logs', description: 'Audit logs' },
  { name: 'notifications', description: 'Notifications' },

  // Memberships
  { name: 'join_requests', description: 'Join requests' },
  { name: 'chama_invites', description: 'Chama invites' },
  { name: 'chama_members', description: 'Chama members' },

  // Parent tables
  { name: 'chamas', description: 'Chamas' },
  { name: 'users', description: 'Users' },
];

const SEQUENCES = [
  'users_user_id_seq',
  'chamas_chama_id_seq',
  'contributions_contribution_id_seq',
  'meetings_meeting_id_seq',
  'loans_loan_id_seq',
  'notifications_notification_id_seq',
  'join_requests_request_id_seq',
];

async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function getStats() {
  console.log('\n📊 Current Database Statistics:');
  const stats = await db.getStats();

  for (const [table, count] of Object.entries(stats)) {
    if (count !== 'N/A' && count !== 'Error' && count > 0) {
      console.log(`   ${table}: ${count}`);
    }
  }
  console.log('');
}

async function cleanupUsers(dryRun = false) {
  try {
    console.log('🧹 ChamaSmart Database Cleanup\n');
    console.log('='.repeat(60));

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Show current state
    await getStats();

    // Confirm action
    if (!dryRun) {
      const confirmed = await askConfirmation(
        '⚠️  This will DELETE ALL DATA. Are you sure? (yes/no): ',
      );

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }

      const doubleCheck = await askConfirmation(
        '⚠️  FINAL WARNING: This is irreversible. Continue? (yes/no): ',
      );

      if (!doubleCheck) {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    }

    console.log('\n🗑️  Deleting data in safe order...\n');

    let totalDeleted = 0;
    const deletionResults = [];

    // Delete tables in order
    for (const { name, description } of DELETION_ORDER) {
      if (dryRun) {
        const exists = await db.tableExists(name);
        if (exists) {
          const result = await db.query(
            `SELECT COUNT(*) as count FROM ${name}`,
          );
          const count = parseInt(result.rows[0].count);
          console.log(
            `   Would delete ${count} rows from ${name} (${description})`,
          );
          totalDeleted += count;
        }
      } else {
        const rowCount = await db.safeDelete(name);
        deletionResults.push({ table: name, rows: rowCount });
        totalDeleted += rowCount;
      }
    }

    if (!dryRun) {
      // Reset sequences
      console.log('\n🔄 Resetting ID sequences...');
      let resetCount = 0;

      for (const seq of SEQUENCES) {
        if (await db.resetSequence(seq)) {
          resetCount++;
        }
      }

      console.log(`✅ Reset ${resetCount}/${SEQUENCES.length} sequences`);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    if (dryRun) {
      console.log(`📊 Would delete ${totalDeleted} total rows`);
      console.log('\nRun without --dry-run to execute cleanup');
    } else {
      console.log('✨ Cleanup completed successfully!');
      console.log(`📊 Deleted ${totalDeleted} total rows`);
      console.log('📝 Database is now ready for fresh user registration.');

      // Log to audit
      logger.info('Database cleanup completed', {
        timestamp: new Date().toISOString(),
        totalRowsDeleted: totalDeleted,
        deletionResults,
      });
    }
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    logger.error('Database cleanup failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (args.includes('--help')) {
  console.log(`
Usage: node scripts/cleanup-users.js [options]

Options:
  --dry-run    Show what would be deleted without making changes
  --force      Skip confirmation prompts (use with caution)
  --help       Show this help message

Examples:
  node scripts/cleanup-users.js --dry-run
  node scripts/cleanup-users.js
  node scripts/cleanup-users.js --force
  `);
  process.exit(0);
}

cleanupUsers(dryRun);
