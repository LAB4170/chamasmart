const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD),
  port: process.env.DB_PORT,
  max: 20, // Max clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000, // Increased to 60s for slow environments
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("⚠️ Error connecting to PostgreSQL (will retry):", err.message);
    // Do not exit process, allow pool to retry internally or requests to fail gracefully
    return;
  }
  console.log("✅ PostgreSQL connected successfully");
  release();
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

module.exports = pool;
