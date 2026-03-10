const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function test1010Features() {
  const client = await pool.connect();
  let chamaId, u1, u2, cycleId;
  try {
    console.log('--- ROSCA 10/10 VERIFICATION ---');

    // 1. Create Test Chama & Users (Auto-commit)
    console.log('Creating isolated test environment...');
    const user1Res = await client.query("INSERT INTO users (email, first_name, last_name, phone_number, password_hash) VALUES ('test1@1010.com', 'Test', 'One', '254700000001', 'hash') RETURNING user_id");
    const user2Res = await client.query("INSERT INTO users (email, first_name, last_name, phone_number, password_hash) VALUES ('test2@1010.com', 'Test', 'Two', '254700000002', 'hash') RETURNING user_id");
    u1 = user1Res.rows[0].user_id;
    u2 = user2Res.rows[0].user_id;

    const chamaRes = await client.query("INSERT INTO chamas (chama_name, chama_type, created_by, current_fund) VALUES ('10/10 Test Chama', 'ROSCA', $1, 0) RETURNING chama_id", [u1]);
    chamaId = chamaRes.rows[0].chama_id;

    await client.query("INSERT INTO chama_members (chama_id, user_id, role, is_active) VALUES ($1, $2, 'CHAIRPERSON', true), ($1, $3, 'MEMBER', true)", [chamaId, u1, u2]);

    // 2. Setup a test cycle with Autopilot
    const cycleRes = await client.query(`
        INSERT INTO rosca_cycles (chama_id, cycle_name, contribution_amount, frequency, start_date, end_date, total_members, status, autopilot_enabled)
        VALUES ($1, 'Test 10/10 Cycle', 1000, 'DAILY', NOW(), NOW() + INTERVAL '5 days', 2, 'ACTIVE', true)
        RETURNING cycle_id
    `, [chamaId]);
    cycleId = cycleRes.rows[0].cycle_id;
    console.log('Created test cycle:', cycleId);

    // Add 2 members to roster
    await client.query(`
        INSERT INTO rosca_roster (cycle_id, user_id, position, status)
        VALUES ($1, $2, 1, 'ACTIVE'), ($1, $3, 2, 'ACTIVE')
    `, [cycleId, u1, u2]);

    // 3. Test Autopilot: Pay for position 1
    console.log('\nTesting Autopilot (Round 1 Payout)...');
    
    // Member 1 pays
    await client.query(`
        INSERT INTO contributions (chama_id, user_id, amount, contribution_type, status, cycle_id, contribution_date, verification_status, recorded_by)
        VALUES ($1, $2, 1000, 'ROSCA', 'COMPLETED', $3, NOW(), 'VERIFIED', $2)
    `, [chamaId, u1, cycleId]);

    // Member 2 pays
    await client.query(`
        INSERT INTO contributions (chama_id, user_id, amount, contribution_type, status, cycle_id, contribution_date, verification_status, recorded_by)
        VALUES ($1, $2, 1000, 'ROSCA', 'COMPLETED', $3, NOW(), 'VERIFIED', $4)
    `, [chamaId, u2, cycleId, u1]);

    console.log('Contributions made. Triggering Autopilot check...');
    
    // Manually trigger the function
    const roscaController = require('../controllers/roscaController');
    await roscaController.checkAndTriggerAutoPayout(cycleId);

    // Verify payout happened
    const rosterStatus = await client.query('SELECT status FROM rosca_roster WHERE cycle_id = $1 AND position = 1', [cycleId]);
    console.log('Position 1 Status after Autopilot:', rosterStatus.rows[0].status); // Should be PAID

    const payoutCheck = await client.query("SELECT * FROM contributions WHERE cycle_id = $1 AND contribution_type = 'ROSCA_PAYOUT'", [cycleId]);
    console.log('Payout contribution created:', payoutCheck.rows.length > 0);
    if (payoutCheck.rows.length > 0) {
        console.log('Payout amount:', payoutCheck.rows[0].amount); // Should be 2000 (Gross)
    }

    // 4. Test Swap Request with Fee
    console.log('\nTesting Swap Request with Fee...');
    await client.query(`
        INSERT INTO rosca_swap_requests (cycle_id, requester_id, requester_position, target_position, status, reason, swap_fee, fee_status)
        VALUES ($1, $2, 2, 1, 'PENDING', 'Need money early', 500, 'PENDING')
    `, [cycleId, u2]);
    
    const swapCheck = await client.query('SELECT swap_fee, fee_status FROM rosca_swap_requests WHERE cycle_id = $1', [cycleId]);
    console.log('Swap fee recorded:', swapCheck.rows[0].swap_fee);
    console.log('Fee status:', swapCheck.rows[0].fee_status);

    console.log('\n--- VERIFICATION COMPLETE ---');

  } catch (err) {
    console.error('VERIFICATION FAILED:', err);
  } finally {
    console.log('\nCleaning up test data...');
    try {
        if (cycleId) await client.query('DELETE FROM rosca_roster WHERE cycle_id = $1', [cycleId]);
        if (cycleId) await client.query('DELETE FROM rosca_swap_requests WHERE cycle_id = $1', [cycleId]);
        if (cycleId) await client.query('DELETE FROM contributions WHERE cycle_id = $1', [cycleId]);
        if (cycleId) await client.query('DELETE FROM rosca_cycles WHERE cycle_id = $1', [cycleId]);
        if (chamaId) await client.query('DELETE FROM chama_members WHERE chama_id = $1', [chamaId]);
        if (chamaId) await client.query('DELETE FROM chamas WHERE chama_id = $1', [chamaId]);
        if (u1) await client.query('DELETE FROM users WHERE user_id = $1', [u1]);
        if (u2) await client.query('DELETE FROM users WHERE user_id = $1', [u2]);
        console.log('Test data cleaned up.');
    } catch (cleanupErr) {
        console.error('Cleanup failed:', cleanupErr.message);
    }
    client.release();
    pool.end();
  }
}

test1010Features();
