const pool = require('./config/db');

async function cleanup() {
  console.log("Deleting seed users...");
  try {
    // Delete any user whose email is like 'member%@example.com' or 'test_member%@example.com'
    const res = await pool.query(`
      DELETE FROM users 
      WHERE email LIKE 'member%@example.com' 
      OR email LIKE 'test_member%@example.com'
      OR first_name = 'Jane' AND last_name = 'Doe'
      OR first_name = 'Bob' AND last_name = 'Smith'
      OR first_name = 'Alice' AND last_name = 'Johnson'
      OR first_name = 'Charlie' AND last_name = 'Brown'
      RETURNING *;
    `);
    console.log(`Deleted ${res.rowCount} seed members.`);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

cleanup();
