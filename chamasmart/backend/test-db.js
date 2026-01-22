const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool();

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL");

    // Test query
    const res = await client.query("SELECT NOW()");
    console.log("✅ Database time:", res.rows[0].now);

    // Check users table
    try {
      const users = await client.query("SELECT COUNT(*) FROM users");
      console.log(`✅ Users table exists with ${users.rows[0].count} records`);
    } catch (e) {
      console.error("❌ Error querying users table:", e.message);
    }
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

testConnection();
