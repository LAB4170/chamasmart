const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('./config/db');

async function testMultiOfficialApproval() {
  console.log('--- Testing Multi-Official Loan Approval ---');

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    
    // 1. Create a loan for user 1 in chama 8
    // We need a loan in PENDING status.
    const loanInsert = await pool.query(
      `INSERT INTO loans (chama_id, borrower_id, loan_amount, interest_rate, term_months, status, purpose)
       VALUES (8, 1, 1000, 10, 1, 'PENDING', 'Test Multi-Approval')
       RETURNING loan_id`
    );
    const loanId = loanInsert.rows[0].loan_id;
    console.log(`✅ Created test loan: ${loanId}`);

    // 2. Identify officials for chama 8
    // User 1 is likely an official, but cannot approve own loan.
    // Let's find other officials or make them.
    // Chama 8 officials:
    const officials = await pool.query(
      "SELECT user_id, role FROM chama_members WHERE chama_id = 8 AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY') AND user_id != 1 LIMIT 2"
    );

    if (officials.rows.length < 2) {
      console.log('Insufficient officials found for testing. Adding dummy officials...');
      // Ensure users exists
      await pool.query("INSERT INTO users (user_id, first_name, last_name, email, password_hash, phone_number) VALUES (101, 'Official', 'One', 'one@test.com', 'hash', '111'), (102, 'Official', 'Two', 'two@test.com', 'hash', '222') ON CONFLICT (user_id) DO NOTHING");
      await pool.query("INSERT INTO chama_members (chama_id, user_id, role, is_active) VALUES (8, 101, 'CHAIRPERSON', true), (8, 102, 'TREASURER', true) ON CONFLICT (chama_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true");
    }

    const testOfficial1 = 101;
    const testOfficial2 = 102;

    const token1 = jwt.sign({ sub: testOfficial1 }, JWT_SECRET, { expiresIn: '1h' });
    const token2 = jwt.sign({ sub: testOfficial2 }, JWT_SECRET, { expiresIn: '1h' });

    // 3. First approval
    console.log(`Official ${testOfficial1} approving...`);
    const res1 = await axios.post(`http://localhost:5005/api/loans/${loanId}/official-approve`, {
      action: 'APPROVED',
      notes: 'First approval'
    }, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    console.log('API Response 1:', res1.data.message);
    
    const loanCheck1 = await pool.query("SELECT status FROM loans WHERE loan_id = $1", [loanId]);
    console.log('Loan Status after 1st approval:', loanCheck1.rows[0].status);
    if (loanCheck1.rows[0].status === 'PENDING') {
      console.log('✅ Correct: Loan remains PENDING after only 1 approval.');
    } else {
      console.log('❌ FAIL: Loan status changed prematurely.');
    }

    // 4. Second approval
    console.log(`Official ${testOfficial2} approving...`);
    const res2 = await axios.post(`http://localhost:5005/api/loans/${loanId}/official-approve`, {
      action: 'APPROVED',
      notes: 'Second approval'
    }, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    console.log('API Response 2:', res2.data.message);

    const loanCheck2 = await pool.query("SELECT status FROM loans WHERE loan_id = $1", [loanId]);
    console.log('Loan Status after 2nd approval:', loanCheck2.rows[0].status);
    if (loanCheck2.rows[0].status === 'APPROVED') {
      console.log('✅ Correct: Loan status changed to APPROVED after 2 approvals.');
    } else {
      console.log('❌ FAIL: Loan status did not change to APPROVED.');
    }

    process.exit(0);
  } catch (error) {
    if (error.response) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testMultiOfficialApproval();
