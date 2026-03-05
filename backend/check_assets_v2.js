// check_assets_v2.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function main() {
  const chamaId = 19;
  const userId = 1; // Assuming a user ID for testing

  console.log(`--- Debugging ASCA Equity for Chama ${chamaId} ---`);

  try {
    // 1. Check if 'assets' table exists and its columns
    console.log('Checking assets table...');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets'
    `);
    console.log('Columns in assets:', columns.rows.map(c => c.column_name));

    // 2. Dry run of the queries in getMyEquity
    console.log('\nDry run of getMyEquity queries:');
    
    console.log('Query 1: userAgg');
    const userAgg = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_amount, COALESCE(SUM(number_of_shares), 0) AS total_shares
      FROM asca_share_contributions
      WHERE chama_id = $1`, [chamaId]);
    console.log('UserAgg result:', userAgg.rows[0]);

    console.log('Query 2: chamaRow');
    const chamaRow = await pool.query('SELECT current_fund, share_price FROM chamas WHERE chama_id = $1', [chamaId]);
    console.log('ChamaRow result:', chamaRow.rows[0]);

    console.log('Query 3: sharesAgg');
    const sharesAgg = await pool.query(`
      SELECT COALESCE(SUM(number_of_shares), 0) AS total_shares
      FROM asca_share_contributions
      WHERE chama_id = $1`, [chamaId]);
    console.log('SharesAgg result:', sharesAgg.rows[0]);

    console.log('Query 4: assetsAgg');
    const assetsAgg = await pool.query(`
      SELECT COALESCE(SUM(current_valuation), 0) AS total_assets
      FROM assets
      WHERE chama_id = $1`, [chamaId]);
    console.log('AssetsAgg result:', assetsAgg.rows[0]);

    console.log('\n--- ALL QUERIES PASSED ---');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR DETECTED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
