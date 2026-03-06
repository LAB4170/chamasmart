require('dotenv').config();
const p = require('./config/db');

async function standardizeStatuses() {
  try {
    console.log("Standardizing statuses to uppercase...");
    const res = await p.query("UPDATE loans SET status = UPPER(status) RETURNING loan_id, status");
    console.log(`Updated ${res.rowCount} rows.`);
    
    // Also fix schedules just in case
    await p.query("UPDATE loan_schedules SET status = UPPER(status) WHERE status IS NOT NULL");
    
    console.log("Cleanup complete.");
  } catch (err) {
    console.error("Standardization failed:", err);
  } finally {
    p.end();
  }
}

standardizeStatuses();
