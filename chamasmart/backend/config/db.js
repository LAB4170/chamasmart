const { Pool } = require("pg");
require("dotenv").config();

const logger = require("../utils/logger");

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
    logger.error("Error connecting to PostgreSQL (will retry)", {
      error: err.message,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
    });
    return;
  }
  logger.info("PostgreSQL connected successfully", {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    maxConnections: 20,
  });
  release();
});

// Handle pool errors
pool.on("error", (err) => {
  logger.error("Unexpected error on idle PostgreSQL client", {
    error: err.message,
    stack: err.stack,
  });
});

// Instrumented query method for metrics
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const start = Date.now();
  const queryText = typeof args[0] === 'string' ? args[0] : args[0].text;

  try {
    const result = await originalQuery(...args);
    const duration = Date.now() - start;

    // Log slow queries
    if (duration > 1000) {
      logger.warn('Slow database query detected', {
        query: queryText.substring(0, 200),
        duration: `${duration}ms`,
        rowCount: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    logger.error('Database query error', {
      query: queryText.substring(0, 200),
      error: error.message,
    });
    throw error;
  }
};

module.exports = pool;
