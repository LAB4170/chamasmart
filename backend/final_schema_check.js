const pool = require('./config/db');

async function getFullSchema() {
  const tables = ['chamas', 'contributions', 'audit_logs', 'loans', 'loan_repayments', 'welfare_claims', 'welfare_fund', 'chama_score_cache'];
  
  for (const table of tables) {
    try {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position`, 
      [table]);
      
      if (res.rows.length === 0) {
        console.log(`Table: ${table} (NOT FOUND)`);
      } else {
        console.log(`Table: ${table}`);
        console.log(`Columns: ${res.rows.map(r => r.column_name).join(', ')}`);
      }
      console.log('-----------------------------------');
    } catch (e) {
      console.error(`Error checking ${table}: ${e.message}`);
    }
  }
}

getFullSchema().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
