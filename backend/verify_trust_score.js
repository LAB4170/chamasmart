const pool = require('./config/db');
const TrustScoreService = require('./utils/trustScoreService');

const verifyTrustScore = async () => {
  try {
    console.log('--- Trust Score Verification ---');
    
    // 1. Get a test member
    const memberRes = await pool.query('SELECT chama_id, user_id FROM chama_members LIMIT 1');
    if (memberRes.rows.length === 0) {
      console.log('No members found to test.');
      return;
    }
    
    const { chama_id, user_id } = memberRes.rows[0];
    console.log(`Testing for Chama ID: ${chama_id}, User ID: ${user_id}`);

    // 2. Trigger update
    const score = await TrustScoreService.updateMemberTrustScore(chama_id, user_id);
    console.log(`✅ Trust Score Calculated: ${score}%`);

    // 3. Check DB persistence
    const checkRes = await pool.query('SELECT trust_score FROM chama_members WHERE chama_id = $1 AND user_id = $2', [chama_id, user_id]);
    console.log(`✅ Persisted Score: ${checkRes.rows[0].trust_score}%`);

    if (score === checkRes.rows[0].trust_score) {
      console.log('🚀 Verification SUCCESSFUL');
    } else {
      console.error('❌ Score mismatch!');
    }

  } catch (err) {
    console.error('❌ Verification FAILED:', err);
  } finally {
    pool.end();
  }
};

verifyTrustScore();
