require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function deepAuditCheck() {
  try {
    // 1. Get EXACT column list for audit_logs
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position
    `);

    process.stdout.write('\n=== EXACT AUDIT_LOGS COLUMNS ===\n');
    cols.rows.forEach(r => process.stdout.write(`  ${r.column_name} (${r.data_type}) nullable:${r.is_nullable}\n`));

    // 2. Get a sample row to see actual data
    const sample = await pool.query('SELECT * FROM audit_logs LIMIT 1');
    process.stdout.write('\n=== SAMPLE AUDIT_LOG ROW ===\n');
    if (sample.rows.length > 0) {
      process.stdout.write(JSON.stringify(sample.rows[0], null, 2) + '\n');
    } else {
      process.stdout.write('  NO ROWS IN audit_logs table!\n');
    }

    // 3. Count total rows
    const count = await pool.query('SELECT COUNT(*) FROM audit_logs');
    process.stdout.write(`\n=== TOTAL AUDIT_LOGS ROWS: ${count.rows[0].count} ===\n`);

    // 4. Test the membership check that the controller does
    const memberCheck = await pool.query(`
      SELECT chama_id, user_id, role FROM chama_members 
      WHERE is_active = true LIMIT 3
    `);
    process.stdout.write('\n=== ACTIVE CHAMA_MEMBERS (sample) ===\n');
    memberCheck.rows.forEach(r => process.stdout.write(`  chama_id:${r.chama_id} user_id:${r.user_id} role:${r.role}\n`));

  } catch (err) {
    process.stdout.write(`FATAL ERROR: ${err.message}\n${err.stack}\n`);
  } finally {
    pool.end();
  }
}

deepAuditCheck();
