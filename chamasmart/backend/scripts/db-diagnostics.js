/**
 * Database Diagnostics & Health Check
 * Consolidates: diagnose.js, check_schema.js, check_status.js
 *
 * Usage: node scripts/db-diagnostics.js [--table=tablename] [--verbose]
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DatabaseUtils = require('./utils/db-utils');

const db = new DatabaseUtils();

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check environment variables
 */
async function checkEnvironment() {
  log('\n📋 Environment Variables:', 'blue');

  const requiredVars = [
    'DB_USER',
    'DB_HOST',
    'DB_NAME',
    'DB_PASSWORD',
    'DB_PORT',
    'JWT_SECRET',
    'NODE_ENV',
  ];

  const optionalVars = ['REDIS_HOST', 'REDIS_PORT', 'EMAIL_HOST', 'EMAIL_USER'];

  let allGood = true;

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      const value = varName.includes('PASSWORD') || varName.includes('SECRET')
        ? '***********'
        : process.env[varName];
      log(`  ✅ ${varName.padEnd(20)} = ${value}`, 'green');
    } else {
      log(`  ❌ ${varName.padEnd(20)} - MISSING`, 'red');
      allGood = false;
    }
  }

  log('\n  Optional Variables:', 'cyan');
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      log(`  ✅ ${varName.padEnd(20)} - Set`, 'green');
    } else {
      log(`  ⚠️  ${varName.padEnd(20)} - Not set`, 'yellow');
    }
  }

  return allGood;
}

/**
 * Check dependencies
 */
async function checkDependencies() {
  log('\n🔧 Dependencies:', 'blue');

  // BCrypt
  try {
    await bcrypt.hash('test', 10);
    log('  ✅ BCrypt working', 'green');
  } catch (error) {
    log(`  ❌ BCrypt failed: ${error.message}`, 'red');
  }

  // JWT
  try {
    if (process.env.JWT_SECRET) {
      jwt.sign({ id: 1 }, process.env.JWT_SECRET);
      log('  ✅ JWT working', 'green');
    } else {
      log('  ⚠️  JWT_SECRET not set', 'yellow');
    }
  } catch (error) {
    log(`  ❌ JWT failed: ${error.message}`, 'red');
  }
}

/**
 * Check database connection
 */
async function checkDatabase() {
  log('\n🗄️  Database Connection:', 'blue');

  try {
    const result = await db.query(
      'SELECT NOW() as current_time, version() as version',
    );
    log('  ✅ Database connected', 'green');
    log(`  ⏰ Server time: ${result.rows[0].current_time}`, 'cyan');
    log(`  📌 Version: ${result.rows[0].version.split(',')[0]}`, 'cyan');
    return true;
  } catch (error) {
    log(`  ❌ Database connection failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Check table structure
 */
async function checkTableStructure(tableName) {
  const exists = await db.tableExists(tableName);

  if (!exists) {
    log(`  ❌ Table '${tableName}' does not exist`, 'red');
    return;
  }

  log(`  ✅ Table '${tableName}' exists`, 'green');

  const columns = await db.getTableColumns(tableName);

  log(`  📊 Columns (${columns.length}):`, 'cyan');
  columns.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultVal = col.column_default
      ? ` DEFAULT ${col.column_default}`
      : '';
    log(
      `     - ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`,
    );
  });
}

/**
 * Check critical tables
 */
async function checkCriticalTables() {
  log('\n📦 Critical Tables:', 'blue');

  const criticalTables = [
    {
      name: 'users',
      requiredColumns: [
        'user_id',
        'email',
        'password_hash',
        'first_name',
        'last_name',
      ],
    },
    {
      name: 'chamas',
      requiredColumns: ['chama_id', 'chama_name', 'created_by'],
    },
    {
      name: 'chama_members',
      requiredColumns: ['member_id', 'chama_id', 'user_id', 'role'],
    },
    {
      name: 'contributions',
      requiredColumns: ['contribution_id', 'chama_id', 'user_id', 'amount'],
    },
    {
      name: 'loans',
      requiredColumns: ['loan_id', 'chama_id', 'user_id', 'amount', 'status'],
    },
    {
      name: 'meetings',
      requiredColumns: ['meeting_id', 'chama_id', 'meeting_date'],
    },
    {
      name: 'notifications',
      requiredColumns: ['notification_id', 'user_id', 'type', 'message'],
    },
  ];

  for (const { name, requiredColumns } of criticalTables) {
    const exists = await db.tableExists(name);

    if (!exists) {
      log(`  ❌ ${name.padEnd(20)} - MISSING`, 'red');
      continue;
    }

    const columns = await db.getTableColumns(name);
    const columnNames = columns.map(c => c.column_name);
    const missingColumns = requiredColumns.filter(
      c => !columnNames.includes(c),
    );

    if (missingColumns.length === 0) {
      const rowCount = await db.query(`SELECT COUNT(*) as count FROM ${name}`);
      log(`  ✅ ${name.padEnd(20)} - ${rowCount.rows[0].count} rows`, 'green');
    } else {
      log(
        `  ⚠️  ${name.padEnd(20)} - Missing columns: ${missingColumns.join(', ')}`,
        'yellow',
      );
    }
  }
}

/**
 * Check indexes
 */
async function checkIndexes(tableName = null) {
  log('\n🔍 Database Indexes:', 'blue');

  const query = tableName
    ? `SELECT tablename, indexname, indexdef 
       FROM pg_indexes 
       WHERE schemaname = 'public' AND tablename = $1
       ORDER BY tablename, indexname`
    : `SELECT tablename, indexname, indexdef 
       FROM pg_indexes 
       WHERE schemaname = 'public'
       ORDER BY tablename, indexname`;

  const params = tableName ? [tableName] : [];
  const result = await db.query(query, params);

  if (result.rows.length === 0) {
    log('  ⚠️  No indexes found', 'yellow');
    return;
  }

  let currentTable = '';
  result.rows.forEach(row => {
    if (row.tablename !== currentTable) {
      currentTable = row.tablename;
      log(`\n  📊 ${currentTable}:`, 'cyan');
    }
    log(`     - ${row.indexname}`);
  });
}

/**
 * Check foreign keys
 */
async function checkForeignKeys() {
  log('\n🔗 Foreign Key Constraints:', 'blue');

  const result = await db.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  if (result.rows.length === 0) {
    log('  ⚠️  No foreign keys found', 'yellow');
    return;
  }

  let currentTable = '';
  result.rows.forEach(row => {
    if (row.table_name !== currentTable) {
      currentTable = row.table_name;
      log(`\n  📊 ${currentTable}:`, 'cyan');
    }
    log(
      `     ${row.column_name} → ${row.foreign_table_name}(${row.foreign_column_name})`,
    );
  });
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  log('\n📈 Database Statistics:', 'blue');

  const stats = await db.getStats();

  let totalRecords = 0;
  for (const [table, count] of Object.entries(stats)) {
    if (typeof count === 'number') {
      totalRecords += count;
      const countStr = count.toLocaleString();
      log(`  ${table.padEnd(25)} ${countStr.padStart(10)} rows`);
    }
  }

  log(`\n  Total Records: ${totalRecords.toLocaleString()}`, 'cyan');
}

/**
 * Check database size
 */
async function checkDatabaseSize() {
  log('\n💾 Database Size:', 'blue');

  const result = await db.query(`
    SELECT 
      pg_size_pretty(pg_database_size(current_database())) as db_size,
      pg_size_pretty(pg_total_relation_size('users')) as users_size,
      pg_size_pretty(pg_total_relation_size('chamas')) as chamas_size,
      pg_size_pretty(pg_total_relation_size('contributions')) as contributions_size
  `);

  const sizes = result.rows[0];
  log(`  Database total: ${sizes.db_size}`, 'cyan');
  log(`  Users table: ${sizes.users_size}`, 'cyan');
  log(`  Chamas table: ${sizes.chamas_size}`, 'cyan');
  log(`  Contributions table: ${sizes.contributions_size}`, 'cyan');
}

/**
 * Main diagnostics
 */
async function runDiagnostics(options = {}) {
  const startTime = Date.now();

  log(`\n${'='.repeat(70)}`, 'cyan');
  log('  CHAMASMART DATABASE DIAGNOSTICS', 'cyan');
  log('='.repeat(70), 'cyan');

  // Check environment
  const envOk = await checkEnvironment();

  if (!envOk) {
    log(
      '\n❌ Critical environment variables missing. Fix .env file first.',
      'red',
    );
    process.exit(1);
  }

  // Check dependencies
  await checkDependencies();

  // Check database connection
  const dbOk = await checkDatabase();

  if (!dbOk) {
    log('\n❌ Cannot connect to database. Check configuration.', 'red');
    process.exit(1);
  }

  // Check tables
  if (options.table) {
    await checkTableStructure(options.table);
  } else {
    await checkCriticalTables();
  }

  // Additional checks
  if (options.verbose) {
    await checkIndexes(options.table);
    await checkForeignKeys();
    await checkDatabaseSize();
  }

  // Statistics
  await getDatabaseStats();

  const executionTime = Date.now() - startTime;

  log(`\n${'='.repeat(70)}`, 'cyan');
  log(`  ✅ DIAGNOSTICS COMPLETE (${executionTime}ms)`, 'green');
  log(`${'='.repeat(70)}\n`, 'cyan');
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  table: null,
};

// Extract table name
const tableArg = args.find(arg => arg.startsWith('--table='));
if (tableArg) {
  options.table = tableArg.split('=')[1];
}

if (args.includes('--help')) {
  console.log(`
Database Diagnostics - Comprehensive database health check

Usage:
  node scripts/db-diagnostics.js [options]

Options:
  --table=NAME    Check specific table structure
  --verbose, -v   Show detailed information (indexes, foreign keys, sizes)
  --help          Show this help message

Examples:
  node scripts/db-diagnostics.js
  node scripts/db-diagnostics.js --verbose
  node scripts/db-diagnostics.js --table=users
  node scripts/db-diagnostics.js --table=chamas --verbose
  `);
  process.exit(0);
}

// Run diagnostics
runDiagnostics(options)
  .catch(error => {
    log(`\n❌ Diagnostics failed: ${error.message}`, 'red');
    process.exit(1);
  })
  .finally(() => db.close());

module.exports = { runDiagnostics };
