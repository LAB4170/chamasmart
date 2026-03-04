const pool = require('./config/db');
const TrustScoreService = require('./utils/trustScoreService');

async function refreshAndVerify() {
  const client = await pool.connect();
  try {
    console.log('--- REFRESHING DATA ---');
    
    // 1. Recalculate Trust Scores for Chama 1
    console.log('Recalculating Trust Scores for Chama 1...');
    const trustResults = await TrustScoreService.analyzeChamaReliability(1);
    console.log('Trust Scores Updated:', trustResults);
    
    // 2. Fetch Stats to verify Fix 1 (Financial Sync)
    const statsRes = await client.query(`
      SELECT 
        (SELECT COALESCE(SUM(c.amount), 0) FROM contributions c WHERE c.chama_id = 1 AND c.is_deleted = false AND c.status = 'COMPLETED') as total_collected,
        current_fund
      FROM chamas 
      WHERE chama_id = 1
    `);
    
    console.log('\n--- VERIFICATION RESULTS ---');
    console.log('Total Collected (from DB logic):', statsRes.rows[0].total_collected);
    console.log('Current Fund (from Chama balance):', statsRes.rows[0].current_fund);
    
    // 3. Verify Trust Scores in Member Table
    const memberRes = await client.query('SELECT user_id, trust_score FROM chama_members WHERE chama_id = 1');
    console.log('\nFinal Trust Scores in Table:');
    memberRes.rows.forEach(r => console.log(`  User ${r.user_id}: ${r.trust_score}`));
    
    if (parseFloat(statsRes.rows[0].total_collected) === 0) {
      console.log('\n✅ PASS: Financial sync works (Total Collected is 0)');
    } else {
      console.log('\n❌ FAIL: Total Collected is still', statsRes.rows[0].total_collected);
    }

  } catch (e) {
    console.error('Error during verification:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

refreshAndVerify();
