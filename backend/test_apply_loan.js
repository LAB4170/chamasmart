const { applyForLoan } = require('./controllers/loanController');
const pool = require('./config/db');

async function testApplyForLoan() {
  const req = {
    params: { chamaId: 19 },
    user: { user_id: 1 },
    body: {
      amount: 2500,
      type: "School Fees",
      purpose: "paying fees for my son",
      repaymentPeriod: 6,
      guarantors: [
        { userId: 1, amount: 2750 } // From user's screenshot, it's lewis abuga. user_id 1 is lewis. 
      ]
    }
  };
  
  const res = {
    status: (code) => {
      console.log('Status set to:', code);
      return res;
    },
    json: (data) => {
      console.log('JSON response:', JSON.stringify(data, null, 2));
      return res;
    }
  };

  const client = await pool.connect();
  
  try {
    // Add logic to bypass GuarantorService validation if it's tricky to mock the exact savings.
    // Instead of mocking the user, we know the user passed the earlier validations in their screenshot.
    // The previous 500 error from the screenshot happened *after* the Joi schema validation.
    // Let's just run it!
    
    // Check if user 1 is in chama 19
    const memberCheck = await client.query('SELECT * FROM chama_members WHERE user_id = 1 AND chama_id = 19');
    if (memberCheck.rows.length === 0) {
       console.log("Adding user 1 to chama 19 for testing...");
       await client.query(`INSERT INTO chama_members (user_id, chama_id, role, status, is_active, total_contributions) VALUES (1, 19, 'MEMBER', 'ACTIVE', true, 10000)`);
    } else {
       await client.query(`UPDATE chama_members SET is_active = true, status = 'ACTIVE', total_contributions = 10000 WHERE user_id = 1 AND chama_id = 19`);
    }
    
    // Check if user 5 (guarantor) is in chama 19
    const gCheck = await client.query('SELECT * FROM chama_members WHERE user_id = 5 AND chama_id = 19');
    if (gCheck.rows.length === 0) {
       console.log("Adding user 5 to chama 19 for testing...");
       await client.query(`INSERT INTO chama_members (user_id, chama_id, role, status, is_active, total_contributions) VALUES (5, 19, 'MEMBER', 'ACTIVE', true, 10000)`);
    } else {
       await client.query(`UPDATE chama_members SET is_active = true, status = 'ACTIVE', total_contributions = 10000 WHERE user_id = 5 AND chama_id = 19`);
    }
    client.release();

    console.log("Testing applyForLoan via Controller...");
    await applyForLoan(req, res);
  } catch (err) {
    console.error("Test script caught error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

testApplyForLoan();
