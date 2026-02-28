const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("Starting migrations...");

    // Run 036
    const sql036 = fs.readFileSync(path.join(__dirname, 'migrations', '036_create_meeting_attendance_table.sql'), 'utf8');
    await client.query("BEGIN");
    await client.query(sql036);
    await client.query("COMMIT");
    console.log("Successfully ran 036_create_meeting_attendance_table.sql");

    // Run 037
    const sql037 = fs.readFileSync(path.join(__dirname, 'migrations', '037_add_meeting_columns.sql'), 'utf8');
    await client.query("BEGIN");
    await client.query(sql037);
    await client.query("COMMIT");
    console.log("Successfully ran 037_add_meeting_columns.sql");

    // Verify
    const verifyQ = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'meeting_attendance'
    `;
    const verifyRes = await client.query(verifyQ);
    if (verifyRes.rows.length > 0) {
      console.log("VERIFICATION SUCCESS: meeting_attendance table exists.");
    } else {
      console.log("VERIFICATION FAILED: meeting_attendance table does NOT exist.");
    }

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();
