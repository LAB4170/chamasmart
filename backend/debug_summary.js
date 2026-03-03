const pool = require('./config/db');

async function testSummary() {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) AS total_actions,
        COUNT(DISTINCT user_id) AS unique_users,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today_actions,
        COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) AS critical_actions
      FROM audit_logs
      WHERE metadata->>'chamaId' = $1
    `, ['1']);
    console.log("SUMMARY SUCCESS:", stats.rows[0]);
  } catch (e) {
    console.error("SUMMARY QUERY ERROR:", e);
  } finally {
    pool.end();
  }
}

testSummary();
