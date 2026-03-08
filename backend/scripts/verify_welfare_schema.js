require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chamasmart',
});

async function verifyWelfareSchema() {
  console.log("Starting Empirical Verification of Welfare Claim Database Fixes...");
  try {
    const chamaId = 20;
    const memberId = 1;

    // The exact query now used in welfareController.js that previously crashed
    const memberQuery = `
      SELECT cm.join_date as joined_at, 
             (SELECT COALESCE(SUM(amount), 0) FROM contributions WHERE user_id = $1 AND chama_id = $2 AND status = 'COMPLETED') as base_savings,
             (SELECT COALESCE(SUM(amount), 0) FROM welfare_contributions WHERE member_id = $1 AND chama_id = $2 AND status = 'COMPLETED') as welfare_savings
      FROM chama_members cm
      WHERE cm.user_id = $1 AND cm.chama_id = $2 AND cm.is_active = true
    `;
    
    console.log("Executing modified member eligibility query...");
    const { rows: memberRows } = await pool.query(memberQuery, [memberId, chamaId]);
    
    if (memberRows.length >= 0) {
      console.log(`[PASS] Query executed successfully without throwing a "column does not exist" error.`);
      console.log(`[PASS] Result:`, memberRows[0] || "No member found (expected for arbitrary ID)");
    }

    console.log("Verification checks completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("[FAIL] Empirical Verification failed due to an error:");
    console.error(error.message);
    process.exit(1);
  }
}

verifyWelfareSchema();
