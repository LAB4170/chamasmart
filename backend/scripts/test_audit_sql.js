const { Pool } = require('pg');
require('dotenv').config({ path: 'C:/Users/Eobord/Desktop/chamasmart/backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testQuery() {
  try {
    const chamaId = '1';
    console.log("Testing getChamaAuditLogs query...");
    const logsResult = await pool.query(`
      SELECT 
        al.*, 
        u.first_name || ' ' || u.last_name as user_name, 
        u.email as user_email,
        COUNT(*) OVER() AS total_count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE al.chama_id = $1 OR al.metadata->>'chamaId' = $1
      ORDER BY al.created_at DESC LIMIT 10 OFFSET 0
    `, [chamaId]);
    console.log("Logs DB query success:", logsResult.rowCount);

    console.log("Testing Summary queries...");
    const daysFilter = 30;
    const summaryStats = await pool.query(`
      SELECT 
         COUNT(*) as total_actions,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_actions,
         COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) as critical_actions
       FROM audit_logs
       WHERE chama_id = $1 OR metadata->>'chamaId' = $1
    `, [chamaId]);
    console.log("Stats query success:", summaryStats.rows[0]);

  } catch (err) {
    console.error("SQL ERROR:", err.message);
  } finally {
    pool.end();
  }
}

testQuery();
