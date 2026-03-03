const { pool } = require('./config/db');
const logger = require('./utils/logger');

async function verifyRoscaLogic() {
  console.log('--- ROSCA Logic Verification ---');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Setup Test Data
    console.log('Setting up test data...');
    
    // Create test user
    const userRes = await client.query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING user_id",
      [`test_rosca_${Date.now()}@example.com`, 'hash', 'Test', 'User']
    );
    const userId = userRes.rows[0].user_id;

    // Create test chama
    const chamaRes = await client.query(
      "INSERT INTO chamas (chama_name, chama_type, created_by, contribution_amount) VALUES ($1, $2, $3, $4) RETURNING chama_id",
      ['Test ROSCA Chama', 'CHAMA', userId, 1000]
    );
    const chamaId = chamaRes.rows[0].chama_id;

    // Add member with trust score
    await client.query(
      "INSERT INTO chama_members (chama_id, user_id, trust_score, role) VALUES ($1, $2, $3, $4)",
      [chamaId, userId, 85, 'ADMIN']
    );

    // 2. Verify Trust Score Query
    console.log('Verifying Trust Score Query Integration...');
    const membersWithScores = await client.query(
      `SELECT cm.user_id, COALESCE(cm.trust_score, 50) as trust_score 
       FROM chama_members cm
       WHERE cm.chama_id = $1 AND cm.user_id = $2`,
      [chamaId, userId]
    );
    
    if (membersWithScores.rows[0].trust_score === 85) {
      console.log('✅ PASS: Trust score correctly retrieved from chama_members.');
    } else {
      console.log('❌ FAIL: Trust score not retrieved correctly.', membersWithScores.rows[0]);
    }

    // 3. Verify Payout Eligibility (SUM Logic)
    console.log('Verifying Payout Eligibility (SUM Logic)...');
    
    // Create a cycle with all required fields
    const cycleRes = await client.query(
      "INSERT INTO rosca_cycles (chama_id, cycle_name, contribution_amount, start_date, end_date, total_members, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING cycle_id",
      [chamaId, 'Test Cycle', 1000, new Date(), new Date(), 1, 'ACTIVE']
    );
    const cycleId = cycleRes.rows[0].cycle_id;

    // Record one contribution that covers TWO rounds (2000)
    await client.query(
      "INSERT INTO contributions (chama_id, user_id, cycle_id, amount, status) VALUES ($1, $2, $3, $4, $5)",
      [chamaId, userId, cycleId, 2000, 'COMPLETED']
    );

    // Test eligibility for round 2
    const payoutPosition = 2; // Second round
    const contributionAmount = 1000;
    
    const eligibilityRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM contributions 
       WHERE cycle_id = $1 AND user_id = $2 AND status = 'COMPLETED'`,
      [cycleId, userId]
    );
    
    const totalContributed = parseFloat(eligibilityRes.rows[0].total);
    const isEligible = totalContributed >= (contributionAmount * payoutPosition);

    if (isEligible) {
      console.log('✅ PASS: Member eligible for round 2 after single large contribution (2000 >= 1000 * 2).');
    } else {
      console.log(`❌ FAIL: Member not eligible. Total: ${totalContributed}, Required: ${contributionAmount * payoutPosition}`);
    }

    await client.query('ROLLBACK'); // Don't persist test data
    console.log('--- Verification Complete ---');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Verification Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyRoscaLogic();
