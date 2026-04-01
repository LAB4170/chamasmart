require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runTest() {
  try {
    // 1. Get Lewis from DB
    const res = await pool.query("SELECT * FROM users WHERE email LIKE '%lewis%' LIMIT 1");
    let user = res.rows[0];
    if (!user) {
       const ures = await pool.query("SELECT * FROM users LIMIT 1");
       user = ures.rows[0];
    }
    
    console.log(`[TEST] Authenticating as: ${user.first_name} ${user.last_name}`);

    // Create a valid token
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Find a ROSCA Chama that user is a member of
    const chamaRes = await pool.query(
      `SELECT c.chama_id, c.chama_name 
       FROM chamas c
       JOIN chama_members cm ON c.chama_id = cm.chama_id
       WHERE c.chama_type = 'ROSCA' AND cm.user_id = $1 LIMIT 1`,
      [user.user_id]
    );
    
    if (chamaRes.rows.length === 0) {
       console.log("No ROSCA chama found for this user.");
       process.exit(1);
    }
    
    const chamaId = chamaRes.rows[0].chama_id;
    console.log(`[TEST] Target Chama: ${chamaRes.rows[0].chama_name} (ID: ${chamaId})`);

    // 3. Check current contributions count for this user in this chama
    const countBefore = await pool.query("SELECT COUNT(*) FROM contributions WHERE chama_id = $1 AND user_id = $2", [chamaId, user.user_id]);
    const totalBefore = parseInt(countBefore.rows[0].count);
    console.log(`[TEST] Contributions before STK Push: ${totalBefore}`);

    // 4. Hit the M-Pesa endpoint
    console.log(`[TEST] Initiating 1 Shilling M-Pesa push to 0796874205...`);
    const apiUrl = `http://localhost:${process.env.PORT || 5005}/api/payments/mpesa/stk-push`;
    
    try {
      const response = await axios.post(apiUrl, {
        chamaId: chamaId,
        phoneNumber: '0796874205',
        amount: 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`[TEST] Response Status: ${response.status}`);
      console.log(`[TEST] Response Data:`, response.data);
    } catch (e) {
      console.log(`[ERROR] API request failed:`, e.response ? e.response.data : e.message);
      process.exit(1);
    }

    // 5. Verify NO record was added to contributions
    const countAfter = await pool.query("SELECT COUNT(*) FROM contributions WHERE chama_id = $1 AND user_id = $2", [chamaId, user.user_id]);
    const totalAfter = parseInt(countAfter.rows[0].count);
    console.log(`[TEST] Contributions after STK Push: ${totalAfter}`);

    if (totalBefore === totalAfter) {
       console.log(`[VALIDATION PASSED] No PIN, No Record rule is explicitly enforced. The ledger was not updated prematurely!`);
    } else {
       console.log(`[VALIDATION FAILED] A contribution was recorded BEFORE the callback!`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runTest();
