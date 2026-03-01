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

async function testAuditQueries() {
  try {
    // Step 1: Check audit_logs columns
    console.log("=== AUDIT_LOGS COLUMNS ===");
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => process.stdout.write(`  ${r.column_name} (${r.data_type})\n`));

    // Step 2: Check chama_members columns
    console.log("\n=== CHAMA_MEMBERS COLUMNS ===");
    const cmCols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'chama_members' ORDER BY ordinal_position
    `);
    cmCols.rows.forEach(r => process.stdout.write(`  ${r.column_name}\n`));

    // Step 3: Check whether a user/chama combo exists
    console.log("\n=== FIRST CHAMA_MEMBER ROW ===");
    const member = await pool.query('SELECT * FROM chama_members LIMIT 1');
    if (member.rows.length > 0) {
      const m = member.rows[0];
      process.stdout.write(JSON.stringify(m) + '\n');
      
      const chamaId = m.chama_id;
      const userId = m.user_id;
      
      // Step 4: Test membership check using is_active
      console.log(`\n=== TESTING MEMBER CHECK (chama_id=${chamaId}, user_id=${userId}) ===`);
      try {
        const memberCheck = await pool.query(
          `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
          [chamaId, userId]
        );
        process.stdout.write(`Member check result: ${memberCheck.rowCount} rows\n`);
      } catch (e) {
        process.stdout.write(`MEMBER CHECK ERROR: ${e.message}\n`);
      }

      // Step 5: Test getChamaAuditLogs query
      console.log(`\n=== TESTING LOG QUERY (chama_id=${chamaId}) ===`);
      try {
        const result = await pool.query(`
          SELECT al.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email,
            COUNT(*) OVER() AS total_count
          FROM audit_logs al
          LEFT JOIN users u ON al.user_id = u.user_id
          WHERE al.metadata->>'chamaId' = $1
          ORDER BY al.created_at DESC LIMIT 10 OFFSET 0
        `, [chamaId.toString()]);
        process.stdout.write(`Log query success: ${result.rowCount} rows\n`);
      } catch (e) {
        process.stdout.write(`LOG QUERY ERROR: ${e.message}\n`);
      }

      // Step 6: Test summary query
      console.log(`\n=== TESTING SUMMARY QUERY (chama_id=${chamaId}) ===`);
      try {
        const result = await pool.query(`
          SELECT 
            COUNT(*) as total_actions,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_actions,
            COUNT(*) FILTER (WHERE metadata->>'severity' IN ('HIGH', 'CRITICAL', 'high', 'critical')) as critical_actions
          FROM audit_logs
          WHERE metadata->>'chamaId' = $1
        `, [chamaId.toString()]);
        process.stdout.write(`Summary: ${JSON.stringify(result.rows[0])}\n`);
      } catch (e) {
        process.stdout.write(`SUMMARY QUERY ERROR: ${e.message}\n`);
      }
    } else {
      process.stdout.write('No chama members found!\n');
    }

  } catch (err) {
    process.stdout.write(`Connection error: ${err.message}\n`);
  } finally {
    pool.end();
  }
}

testAuditQueries();
