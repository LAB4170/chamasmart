const { Pool } = require("pg");
require("dotenv").config();

// Database configuration with enhanced security
const requiredEnvVars = ["DB_USER", "DB_PASSWORD", "DB_NAME", "DB_HOST"];

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
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  // Enhanced security settings
  statement_timeout: 30000,
  query_timeout: 30000,
  application_name: "chamasmart-backend",
});

// Handle pool errors gracefully
pool.on("error", (err) => {
  const errorContext = {
    error: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  };

  if (err.code === "ECONNRESET" || err.code === "ENOTFOUND") {
    logger.warn(
      "Database connection lost, will retry on next query",
      errorContext,
    );
  } else {
    logger.error("Database pool error", errorContext);
    metrics.increment("database.error", 1, {
      type: "pool_error",
      code: err.code,
    });
  }
});

/**
 * Test database connection with retry logic
 * @param {number} [retries=3] - Number of retry attempts
 * @param {number} [retryDelay=1000] - Delay between retries in ms
 * @returns {Promise<boolean>} - True if connection successful
 */
const testConnection = async (retries = 3, retryDelay = 1000) => {
  const startTime = Date.now();

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT NOW()");
        const duration = Date.now() - startTime;
        logger.info("Database connection successful", {
          durationMs: duration,
          attempt: i + 1,
          maxRetries: retries,
        });
        metrics.timing("database.connection_time", duration);
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      const isLastAttempt = i === retries - 1;
      const nextRetryIn = isLastAttempt ? 0 : retryDelay * (i + 1);

      logger.error(`Database connection failed (attempt ${i + 1}/${retries})`, {
        error: error.message,
        code: error.code,
        nextRetryIn,
        isLastAttempt,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });

      metrics.increment("database.connection_retry", 1, {
        attempt: i + 1,
        error_code: error.code || "unknown",
      });

      if (isLastAttempt) {
        metrics.increment("database.connection_failed");
        throw new Error(
          `Failed to connect to database after ${retries} attempts: ${error.message}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, nextRetryIn));
    }
  }
  console.error("❌ Failed to connect to database after multiple attempts");
  return false;
};

// Test connection on startup
// testConnection(); // Removing top-level call to prevent startup blocks

module.exports = {
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error("Database query error:", err.message);
      throw err;
    }
  },
  connect: () => pool.connect(),
  end: () => pool.end(),
  pool,
  testConnection,
};
