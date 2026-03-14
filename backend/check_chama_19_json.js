const pool = require('./config/db');
const fs = require('fs');

async function checkChama19() {
  try {
    const chamaParams = [19];
    const results = {};

    const chama = await pool.query('SELECT * FROM chamas WHERE chama_id = $1', chamaParams);
    results.chama = chama.rows[0];

    const members = await pool.query('SELECT * FROM chama_members WHERE chama_id = $1', chamaParams);
    results.members_count = members.rows.length;
    results.members = members.rows;

    const contributions = await pool.query('SELECT * FROM contributions WHERE chama_id = $1', chamaParams);
    results.contributions_count = contributions.rows.length;
    results.contributions = contributions.rows;
    
    const statsResult = await pool.query(
        `WITH member_stats AS (
           SELECT chama_id, COUNT(*) as member_count
           FROM chama_members
           WHERE chama_id = $1 AND is_active = true
           GROUP BY chama_id
         ),
         contribution_stats AS (
           SELECT 
             chama_id, 
             SUM(amount) as total_amount,
             COUNT(*) FILTER (WHERE contribution_date >= CURRENT_DATE - INTERVAL '30 days') as recent_count
           FROM contributions
           WHERE chama_id = $1 AND is_deleted = false AND status = 'COMPLETED'
           GROUP BY chama_id
         )
         SELECT 
           COALESCE(ms.member_count, 0) as total_members,
           COALESCE(cs.total_amount, 0) as total_contributions,
           COALESCE(cs.recent_count, 0) as recent_contributions,
           ch.current_fund,
           ch.contribution_amount,
           ch.chama_type
         FROM chamas ch
         LEFT JOIN member_stats ms ON ch.chama_id = ms.chama_id
         LEFT JOIN contribution_stats cs ON ch.chama_id = cs.chama_id
         WHERE ch.chama_id = $1`,
        chamaParams
    );
    results.stats = statsResult.rows[0];

    fs.writeFileSync('chama_19_debug.json', JSON.stringify(results, null, 2));
    console.log("Results written to chama_19_debug.json");

  } catch (error) {
    console.error(error);
  } finally {
    pool.end();
  }
}

checkChama19();
