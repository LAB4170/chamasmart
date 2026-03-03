const pool = require('./config/db');

async function testAudit() {
  try {
    const result = await pool.query(`
      SELECT
        al.audit_id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.ip_address,
        al.user_agent,
        al.severity,
        al.metadata,
        al.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name,
        u.email AS user_email,
        COUNT(*) OVER() AS total_count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE al.metadata->>'chamaId' = $1
      ORDER BY al.created_at DESC
      LIMIT 100 OFFSET 0
    `, ['1']);
    console.log("SUCCESS:", result.rows.length);
  } catch (e) {
    console.error("QUERY ERROR:", e);
  } finally {
    pool.end();
  }
}

testAudit();
