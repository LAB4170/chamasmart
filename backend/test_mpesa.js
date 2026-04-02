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
    const res = await pool.query("SELECT * FROM users WHERE email LIKE '%lewis%' LIMIT 1");
    let user = res.rows[0];
    if (!user) {
       const ures = await pool.query("SELECT * FROM users LIMIT 1");
       user = ures.rows[0];
    }
    
    console.log(`[TEST] Authenticating as: ${user.first_name} ${user.last_name}`);

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

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
    console.log(`[TEST] Target Chama: ${chamaRes.rows[0].chama_name}`);

    const apiUrl = `http://localhost:${process.env.PORT || 5005}/api/payments/mpesa/stk-push`;
    
    console.log(`[TEST] 1st M-Pesa push to 0796874205...`);
    try {
      await axios.post(apiUrl, { chamaId, phoneNumber: '0796874205', amount: 1 }, { headers: { Authorization: `Bearer ${token}` } });
      console.log(`[TEST] 1st Push Success!`);
    } catch (e) {
      console.log(`[TEST ERROR] 1st push failed (this shouldn't happen unless a prompt is already active):`, e.response?.data?.message || e.message);
    }

    console.log(`[TEST] 2nd IMMEDIATLY M-Pesa push to 0796874205...`);
    try {
      await axios.post(apiUrl, { chamaId, phoneNumber: '0796874205', amount: 1 }, { headers: { Authorization: `Bearer ${token}` } });
      console.log(`[TEST ERRROR] 2nd Push Success! The prompting law FAILED. It should have been blocked.`);
      process.exit(1);
    } catch (e) {
      console.log(`[TEST VALIDATION] 2nd Push correctly blocked: "${e.response?.data?.message}"`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runTest();
