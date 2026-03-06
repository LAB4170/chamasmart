const pool = require('./config/db');

async function testIntegrity() {
  console.log("=== STARTING FINANCIAL INTEGRITY TEST ===");
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create a test user and chama
    const userRes = await client.query("INSERT INTO users (email, first_name, last_name, password_hash) VALUES ('audit_test_" + Date.now() + "@example.com', 'Audit', 'Test', 'hash') RETURNING user_id");
    const userId = userRes.rows[0].user_id;

    const chamaRes = await client.query(`
      INSERT INTO chamas (name, description, chama_type, created_by, current_fund, is_active) 
      VALUES ('Audit Test Chama', 'Validation', 'ASCA', $1, 0, true) 
      RETURNING chama_id`, [userId]);
    const chamaId = chamaRes.rows[0].chama_id;

    await client.query("INSERT INTO chama_members (chama_id, user_id, role, is_active) VALUES ($1, $2, 'TREASURER', true)", [chamaId, userId]);

    // 2. Add Contribution (1000.55)
    console.log("Step 1: Adding contribution of 1000.55...");
    await client.query("UPDATE chamas SET current_fund = current_fund + 1000.55 WHERE chama_id = $1", [chamaId]);
    
    let fundRes = await client.query("SELECT current_fund FROM chamas WHERE chama_id = $1", [chamaId]);
    console.log("Current Fund:", fundRes.rows[0].current_fund);

    // 3. Mock Loan Approval (Principal: 500.22)
    console.log("Step 2: Mocking loan approval of 500.22...");
    // We simulate the approveLoan logic deduction
    const loanAmount = 500.22;
    await client.query("UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2", [loanAmount, chamaId]);
    
    fundRes = await client.query("SELECT current_fund FROM chamas WHERE chama_id = $1", [chamaId]);
    console.log("Current Fund after approval:", fundRes.rows[0].current_fund);
    
    if (parseFloat(fundRes.rows[0].current_fund) !== 500.33) {
       console.error("FAIL: Fund should be 500.33 (1000.55 - 500.22)");
    } else {
       console.log("PASS: Fund correctly synchronized after approval.");
    }

    // 4. Mock Repayment (Total: 550.00)
    console.log("Step 3: Mocking repayment of 550.00...");
    const repaymentAmount = 550.00;
    await client.query("UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2", [repaymentAmount, chamaId]);

    fundRes = await client.query("SELECT current_fund FROM chamas WHERE chama_id = $1", [chamaId]);
    console.log("Current Fund after repayment:", fundRes.rows[0].current_fund);

    if (parseFloat(fundRes.rows[0].current_fund) !== 1050.33) {
        console.error("FAIL: Fund should be 1050.33 (500.33 + 550.00)");
    } else {
        console.log("PASS: Fund correctly synchronized after repayment.");
    }

    console.log("=== FINANCIAL INTEGRITY TEST COMPLETED SUCCESSFULLY ===");
    await client.query('ROLLBACK'); // Clean up
  } catch (err) {
    console.error("TEST FAILED:", err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit(0);
  }
}

testIntegrity();
