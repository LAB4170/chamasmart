const pool = require('./config/db');

async function testStats() {
  try {
    const res = await pool.query(
        `SELECT 
           COUNT(DISTINCT cm.user_id) as total_members,
           COALESCE(SUM(c.amount), 0) as total_contributions,
           ch.current_fund,
           ch.contribution_amount,
           ch.chama_type
         FROM chamas ch
         LEFT JOIN chama_members cm ON ch.chama_id = cm.chama_id AND cm.is_active = true
         LEFT JOIN contributions c ON ch.chama_id = c.chama_id
         WHERE ch.chama_id = $1
         GROUP BY ch.chama_id, ch.current_fund, ch.contribution_amount, ch.chama_type`,
        ['1']
      );
    console.log("STATS:", res.rows[0]);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

testStats();
