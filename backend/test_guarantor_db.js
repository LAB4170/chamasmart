const pool = require('./config/db');
const { GuarantorService } = require('./controllers/loanController');

async function testGuarantor() {
  const client = await pool.connect();
  try {
    const chamaId = 19;
    const borrowerId = 1; // Assuming the logged in user
    // In screenshot: lewis abuga is guarantor, userId could be anything but let's see why it's failing
    // Let's first get the user ID for lewis abuga
    const res = await client.query(`SELECT user_id, first_name, last_name FROM users WHERE first_name ILIKE '%lewis%' OR last_name ILIKE '%abuga%' LIMIT 1`);
    console.log("Found Guarantor:", res.rows);
    
    if (res.rows.length > 0) {
      const gId = res.rows[0].user_id;
      
      const validation = await GuarantorService.validateAll(
        client,
        chamaId,
        [{ userId: gId, amount: 2750 }],
        borrowerId,
        2750
      );
      
      console.log("Validation Result:", JSON.stringify(validation, null, 2));

      // Attempt mock loan insert to trigger the 500 error
      console.log("Attempting mock loan insert...");
      const loanRes = await client.query(
        `INSERT INTO loans (
          chama_id, borrower_id, loan_amount, 
          interest_rate, total_repayable,
          term_months, status, purpose,
          monthly_payment
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) RETURNING *`,
        [chamaId, borrowerId, 2500, 10, 2750, 6, 'PENDING', 'fees', 458]
      );
      console.log("Loan inserted:", loanRes.rows[0].loan_id);

      // Attempt guarantor insert
      await client.query(
        `INSERT INTO loan_guarantors (loan_id, guarantor_user_id, guarantee_amount, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [loanRes.rows[0].loan_id, gId, 2750]
      );
      console.log("Guarantor inserted");

      // Attempt notification insert (this is where crashes might happen if related_id expects string)
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_id)
         VALUES ($1, 'LOAN_GUARANTEE_REQUEST', 'Guarantee Request', 
                 'You have been requested to guarantee a loan', $2)`,
        [gId, loanRes.rows[0].loan_id]
      );
      console.log("Notification inserted");

      // Rollback since this is a test
      await client.query("ROLLBACK");
      console.log("Success! No 500 triggered in DB logic.");
    }
  } catch (err) {
    console.error("DB EXCEPTION CAUGHT:", err);
    await client.query("ROLLBACK");
  } finally {
    client.release();
    pool.end();
  }
}

testGuarantor();
