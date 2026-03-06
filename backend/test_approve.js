require('dotenv').config();
const pool = require('./config/db');
const loanController = require('./controllers/loanController');

async function test() {
  try {
    const chamaId = 19;
    const loanId = 41;
    // Find an official
    const officialRes = await pool.query(
      `SELECT user_id FROM chama_members 
       WHERE chama_id = $1 AND role IN ('CHAIRPERSON', 'TREASURER', 'ADMIN') LIMIT 1`,
      [chamaId]
    );
    if(officialRes.rows.length === 0) {
      console.log("No official found for chama 19");
      return;
    }
    const officialId = officialRes.rows[0].user_id;
    console.log("Using official ID:", officialId);

    const req = {
      params: { chamaId, loanId },
      body: {}, // empty body triggered the bug maybe?
      user: { user_id: officialId }
    };
    
    // Custom res object to trace execution
    const res = {
      status: function(code) {
        console.log(`STATUS CODE: ${code}`);
        return this;
      },
      json: function(data) {
        console.log("RESPONSE JSON:", JSON.stringify(data, null, 2));
      }
    };

    console.log("\n--- Testing approveLoan ---");
    // Intercept console.error to see what's failing inside catch block
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError("\n[CAPTURED INTERNAL ERROR]:");
      originalConsoleError(...args);
    };

    await loanController.approveLoan(req, res);
    console.log("--- Test finished ---");
  } catch (err) {
    console.error("Test function crashed completely:", err);
  } finally {
    pool.end();
  }
}

test();
