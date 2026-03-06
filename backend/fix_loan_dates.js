require('dotenv').config();
const p = require('./config/db');

async function cleanupDates() {
  try {
    console.log("Cleaning up null loan dates...");
    
    // For any loan where next_payment_at is null, set it to 1 month after creation
    const res = await p.query(`
      UPDATE loans 
      SET next_payment_at = created_at + interval '1 month'
      WHERE next_payment_at IS NULL
      RETURNING loan_id, created_at, next_payment_at
    `);
    
    console.log(`Updated ${res.rowCount} loans.`);
    if (res.rowCount > 0) {
      console.log("Sample updates:", res.rows.slice(0, 3));
    }
  } catch (err) {
    console.error("Cleanup failed:", err);
  } finally {
    p.end();
  }
}

cleanupDates();
