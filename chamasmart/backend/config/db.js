const { Pool } = require('pg');
require('dotenv').config();

// Database configuration with enhanced security
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST'];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `❌ CRITICAL: ${envVar} environment variable is required. Set it in your .env file.`,
    );
  }
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  min: parseInt(process.env.DB_POOL_MIN) || 5,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  // Enhanced security settings
  statement_timeout: 30000,
  query_timeout: 30000,
  application_name: 'chamasmart-backend',
});

// Handle pool errors gracefully
pool.on('error', err => {
  console.error('Database pool error:', err.message);
  // Don't exit process immediately, log and continue
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
    console.log('Database connection lost, will retry on next query');
  } else {
    console.error('Critical database error:', err);
  }
});

// Test database connection with retry logic
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Database connected successfully');
      return true;
    } catch (err) {
      console.error(
        `❌ Database connection attempt ${i + 1} failed:`,
        err.message,
      );
      if (i < retries - 1) {
        console.log(
          `Retrying in 5 seconds... (${retries - i - 1} attempts left)`,
        );
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  console.error('❌ Failed to connect to database after multiple attempts');
  return false;
};

// Test connection on startup
testConnection();

module.exports = {
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error('Database query error:', err.message);
      throw err;
    }
  },
  connect: () => pool.connect(),
  end: () => pool.end(),
  pool,
  testConnection,
};
