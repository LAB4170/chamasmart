const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('./config/db');

async function testAscaLoan() {
  console.log('--- Testing ASCA Loan Hardening ---');

  try {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Assuming cycle 4 or 5 is closed, I need an ACTIVE cycle.
    await pool.query("INSERT INTO asca_cycles (chama_id, cycle_name, start_date, end_date, share_price, total_shares, available_shares, status) VALUES (8, 'Test Loan Cycle', NOW(), NOW() + INTERVAL '1 year', 100, 1000, 1000, 'ACTIVE') RETURNING cycle_id");
    const activeCycle = await pool.query("SELECT cycle_id FROM asca_cycles WHERE chama_id = 8 AND status = 'ACTIVE' ORDER BY cycle_id DESC LIMIT 1");
    const cycleId = activeCycle.rows[0].cycle_id;

    console.log(`Created/found Active Cycle: ${cycleId}`);

    // Give user 1 some shares (e.g. 500 total_investment)
    await pool.query(
      `INSERT INTO asca_members (cycle_id, user_id, shares_owned, total_investment) 
       VALUES ($1, 1, 5, 500)
       ON CONFLICT (cycle_id, user_id) 
       DO UPDATE SET total_investment = 500`, 
    [cycleId]);

    // Attempt a loan > 3x (1500 limit). Let's request 2000.
    console.log('Attempting to borrow 2000 KES (Limit should be 1500)...');
    try {
      await axios.post('http://localhost:5005/api/loans/8/apply', {
        amount: 2000,
        purpose: 'Test Loan > Limit',
        repaymentPeriod: 1,
        guarantors: []
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('❌ FAILED: Loan of 2000 was accepted but should have been rejected.');
    } catch (err) {
      if (err.response && err.response.data.message === 'ASCA Loan Limit Exceeded.') {
        console.log('✅ PASSED: 2000 KES loan rejected correctly.');
      } else {
        console.error('❌ FAILED: Unexpected error:', err.response ? err.response.data : err.message);
      }
    }

    // Attempt a loan <= 3x (1500 limit). Let's request 1000.
    console.log('Attempting to borrow 1000 KES (Limit should be 1500)...');
    const validRes = await axios.post('http://localhost:5005/api/loans/8/apply', {
      amount: 1000,
      purpose: 'Test Loan <= Limit',
      repaymentPeriod: 1,
      guarantors: []
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('✅ PASSED: 1000 KES loan accepted. Data:', validRes.data.message);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

testAscaLoan();
