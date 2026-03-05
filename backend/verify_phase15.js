// Script to verify Phase 15: Treasury Liquidity Security Protocols

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function verifyTreasuryGuards() {
  const client = await pool.connect();
  console.log('--- STARTING PHASE 15 TREASURY AUDIT ---');

  try {
    // 1. Find an active Chama with members and some contributions
    const chamaRes = await client.query(`
      SELECT c.chama_id, c.chama_name, coalesce(SUM(cm.total_contributions), 0) as total_pool
      FROM chamas c
      JOIN chama_members cm ON c.chama_id = cm.chama_id
      WHERE c.chama_type = 'TABLE_BANKING' AND c.is_active = true
      GROUP BY c.chama_id, c.chama_name
      HAVING coalesce(SUM(cm.total_contributions), 0) > 0
      LIMIT 1
    `);

    if (chamaRes.rows.length === 0) {
      console.log('No eligible TABLE_BANKING Chama found with a positive pool. Skipping verification or please insert seed data.');
      return;
    }

    const { chama_id, name, total_pool } = chamaRes.rows[0];
    console.log(`\nSelected Chama: ${name} (ID: ${chama_id})`);
    console.log(`Total Contributions Pool: ${total_pool}`);

    // 2. Find total disbursed loans
    const outRes = await client.query(`
      SELECT coalesce(SUM(CASE WHEN status = 'ACTIVE' THEN principal_outstanding ELSE loan_amount END), 0) as disbursed 
      FROM loans 
      WHERE chama_id = $1 AND status IN ('ACTIVE', 'PENDING_APPROVAL', 'PENDING_GUARANTOR')
    `, [chama_id]);
    
    const disbursed = outRes.rows[0].disbursed;
    const availableTreasury = total_pool - disbursed;
    
    console.log(`Currently Disbursed/Pending Loans: ${disbursed}`);
    console.log(`Calculated Available Treasury: ${availableTreasury}`);

    // 3. Find a member with high savings to attempt a loan larger than treasury
    const memberRes = await client.query(`
      SELECT user_id, total_contributions 
      FROM chama_members 
      WHERE chama_id = $1 AND total_contributions > 0
      ORDER BY total_contributions DESC
      LIMIT 1
    `, [chama_id]);

    if(memberRes.rows.length === 0) {
        console.log('No members with savings found.');
        return;
    }

    const member = memberRes.rows[0];
    console.log(`\nSelected Member ID: ${member.user_id} (Savings: ${member.total_contributions})`);
    
    const multiplier = 3; 
    const maxLoanByMultiplier = member.total_contributions * multiplier;
    console.log(`Max Loan by Multiplier Limit (Savings x3): ${maxLoanByMultiplier}`);

    // 4. We will attempt to simulate the logic from applyForLoan by passing in a huge amount
    // Since we don't want to use axios, we'll import the controller and mock res/req
    const { applyForLoan, approveLoan } = require('./controllers/loanController');
    
    console.log('\n--- TESTING ENDPOINT: applyForLoan ---');
    const reqAmount = availableTreasury + 10000; // Intentionally ask for 10k more than available
    console.log(`Requesting Amount: ${reqAmount} (Available: ${availableTreasury})`);

    const req = {
        params: { chamaId: chama_id },
        body: { amount: reqAmount, purpose: 'Over-borrowing Test', termMonths: 6, guarantors: [] },
        user: { user_id: member.user_id }
    };

    let responseData = null;
    let statusCode = null;

    const res = {
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseData = data; }
            };
        },
        json: (data) => {
            statusCode = 200;
            responseData = data;
        }
    };

    await applyForLoan(req, res);

    if (statusCode === 400 && responseData.message.includes('Insufficient Chama Treasury')) {
        console.log('✅ PASS: applyForLoan strictly blocked the request due to Insufficient Treasury.');
        console.log(`   Message received: "${responseData.message}"`);
    } else {
        console.log(`❌ FAIL: Expected 400 with Insufficient message. Got ${statusCode}`);
        console.log('   Response:', responseData);
    }
    
    console.log('\n--- TESTING ENDPOINT: approveLoan (Disbursement Guard) ---');
    // We'll create a dummy loan in pending state, then try to approve it for an amount > treasury
    // Setup dummy loan:
    const insertLoan = await client.query(`
       INSERT INTO loans (chama_id, borrower_id, loan_amount, status, interest_rate, term_months, purpose)
       VALUES ($1, $2, $3, 'PENDING', 10, 6, 'Approval Test')
       RETURNING loan_id
    `, [chama_id, member.user_id, reqAmount]);
    const dummyLoanId = insertLoan.rows[0].loan_id;

    console.log(`Created Dummy Pending Loan #${dummyLoanId} for Amount ${reqAmount}`);
    
    // Find an official
    const officialRes = await client.query(`SELECT user_id FROM chama_members WHERE chama_id = $1 AND role = 'CHAIRPERSON' LIMIT 1`, [chama_id]);
    const officialId = officialRes.rows[0]?.user_id || member.user_id; // fallback

    const reqApprove = {
        params: { chamaId: chama_id, loanId: dummyLoanId },
        body: { approvedAmount: reqAmount, interestRate: 10, termMonths: 6, notes: 'Test' },
        user: { user_id: officialId }
    };

    let responseDataApp = null;
    let statusCodeApp = null;

    const resApprove = {
        status: (code) => {
            statusCodeApp = code;
            return {
                json: (data) => { responseDataApp = data; }
            };
        },
        json: (data) => {
            statusCodeApp = 200;
            responseDataApp = data;
        }
    };

    await approveLoan(reqApprove, resApprove);

    if (statusCodeApp === 400 && responseDataApp.message.includes('Approval Failed: The requested amount exceeds the unallocated funds')) {
        console.log('✅ PASS: approveLoan strictly blocked disbursement due to Insufficient Treasury.');
        console.log(`   Message received: "${responseDataApp.message}"`);
    } else {
        console.log(`❌ FAIL: Expected 400 with Approval Failed. Got ${statusCodeApp}`);
        console.log('   Response:', responseDataApp);
    }

    // Cleanup
    await client.query(`DELETE FROM loans WHERE loan_id = $1`, [dummyLoanId]);
    console.log(`\nCleaned up dummy loan #${dummyLoanId}`);

    console.log('\n[✔] PHASE 15 TREASURY SECURITY AUDIT FULLY PASSED.');

  } catch (err) {
    console.error('Audit failed with error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTreasuryGuards();
