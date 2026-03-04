const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('./config/db');

async function testExecutePayout() {
  console.log('--- Testing ASCA Cycle Payout Execution ---');

  try {
    const cycleId = 5;

    // Inject enough funds into chama 8 so it doesn't fail
    await pool.query('UPDATE chamas SET current_fund = 10000 WHERE chama_id = 8');
    
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });

    console.log(`Hitting POST /api/asca/8/cycles/${cycleId}/payout...`);
    const payoutRes = await axios.post(`http://localhost:5005/api/asca/8/cycles/${cycleId}/payout`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('API Response:', payoutRes.data);

    // Verify DB states: cycle status and chama fund decrease
    const cycleCheck = await pool.query('SELECT status FROM asca_cycles WHERE cycle_id = $1', [cycleId]);
    console.log('Cycle Status in DB:', cycleCheck.rows[0].status);

    const chamaCheck = await pool.query('SELECT current_fund FROM chamas WHERE chama_id = 8');
    console.log('Chama current fund in DB:', chamaCheck.rows[0].current_fund);

    process.exit(0);
  } catch (error) {
    if (error.response) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

testExecutePayout();
