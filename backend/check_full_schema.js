const pool = require('./config/db');

async function checkSchema() {
  const tables = ['chamas', 'contributions', 'audit_logs', 'loans', 'loan_repayments', 'welfare_claims', 'welfare_fund', 'chama_score_cache'];
  
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
      console.log(`Table: ${table}`);
      console.log(res.rows.map(r => r.column_name).join(', '));
      console.log('---');
    } catch (e) {
      console.error(`Error checking table ${table}:`, e.message);
    }
  }
}

checkSchema().then(() => process.exit(0)).catch(() => process.exit(1));
