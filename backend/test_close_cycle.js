const axios = require('axios');
const pool = require('./config/db');

async function testCloseCycle() {
  try {
    console.log('--- Testing ASCA Cycle Closure ---');

    // 1. Get Chama 8 details
    const cycleRes = await pool.query("SELECT cycle_id FROM asca_cycles WHERE chama_id = 8 AND status = 'ACTIVE'");
    if (cycleRes.rows.length === 0) {
      console.log('No active cycle for Chama 8. Please run verify_asca_status or create one.');
      process.exit(0);
    }
    const cycleId = cycleRes.rows[0].cycle_id;
    console.log(`Found Active Cycle: ${cycleId}`);

    // 2. Mock a loan with some interest payment so we have profit to distribute
    const loanInsert = await pool.query(`
      INSERT INTO loans (chama_id, borrower_id, loan_amount, term_months, status)
      VALUES (8, 1, 1000, 1, 'COMPLETED')
      RETURNING loan_id
    `);
    const loanId = loanInsert.rows[0].loan_id;
    
    await pool.query(`
      INSERT INTO loan_repayments (loan_id, payer_id, amount, payment_method, interest_component)
      VALUES ($1, 1, 1100, 'CASH', 100)
    `, [loanId]);
    console.log('Mocked a loan with 100 KES interest.');

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });
    console.log('Minted JWT token successfully.');

    // Buy shares first so there's equity to distribute to
    const buyRes = await axios.post(`http://localhost:5005/api/asca/8/buy-shares`, {
      amount: 500,
      paymentMethod: 'CASH'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Shares bought successfully:', buyRes.data.data.sharesBought);

    // 4. Hit the close cycle endpoint
    console.log(`Hitting POST /api/asca/8/cycles/${cycleId}/close...`);
    const closeRes = await axios.post(`http://localhost:5005/api/asca/8/cycles/${cycleId}/close`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('API Response:', closeRes.data);

    // 5. Verify Database State
    const cyclesA = await pool.query(`SELECT status FROM asca_cycles WHERE cycle_id = $1`, [cycleId]);
    console.log('Cycle Status in DB:', cyclesA.rows[0].status);

    const members = await pool.query(`SELECT user_id, dividends_earned FROM asca_members WHERE cycle_id = $1`, [cycleId]);
    console.log('Member Dividends:', members.rows);

  } catch (err) {
    if (err.response) {
      console.error('API Error:', err.response.data);
    } else {
      console.error(err);
    }
  } finally {
    process.exit(0);
  }
}

testCloseCycle();
