const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// ============================================================================
// SECURE DATABASE CONFIGURATION
// ============================================================================
// This file implements multiple layers of security to protect database credentials
// ============================================================================

// Layer 1: Environment Variable Validation
const validateDbConfig = () => {
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }
};

// Layer 2: Connection Pool with Security Settings
const createSecurePool = () => {
  validateDbConfig();

  const poolConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Security enhancements
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Connection limits to prevent DoS
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    // Connection timeout
    connectionTimeoutMillis: 10000,
    // Idle timeout
    idleTimeoutMillis: 30000,
    // Statement timeout
    statement_timeout: 30000,
    // Query timeout
    query_timeout: 30000,
  };

  const pool = new Pool(poolConfig);

  // Layer 3: Connection Monitoring
  pool.on('connect', client => {
    console.log('New database client connected');

    // Set secure session parameters
    client.query('SET session.authorization = current_user;')
      .catch(err => console.error('Failed to set session authorization:', err));
  });

  pool.on('error', (err, client) => {
    console.error('Database client error:', err);
    // Log security events
    if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
      console.warn('Potential network attack detected:', err.code);
    }
  });

  return pool;
};

// Layer 4: Query Wrapper with Security Monitoring
const secureQuery = async (text, params, client = null) => {
  const startTime = Date.now();
  const queryId = crypto.randomBytes(8).toString('hex');

  try {
    // Log query attempt (without sensitive data)
    console.log(`Query ${queryId}: ${text.substring(0, 100)}...`);

    // Execute query
    const result = client
      ? await client.query(text, params)
      : await pool.query(text, params);

    const duration = Date.now() - startTime;

    // Log successful query
    console.log(`Query ${queryId} completed in ${duration}ms, ${result.rows.length} rows`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log query error
    console.error(`Query ${queryId} failed after ${duration}ms:`, error.message);

    // Detect potential SQL injection
    if (error.message.includes('syntax error') || error.message.includes('invalid input')) {
      console.warn(`Potential SQL injection attempt in query ${queryId}`);
    }

    throw error;
  }
};

// Layer 5: Transaction Wrapper with Rollback Protection
const secureTransaction = async callback => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    console.log('Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    console.log('Client released');
  }
};

// Layer 6: Health Check with Security Info
const healthCheck = async () => {
  try {
    const result = await pool.query('SELECT version(), current_database(), current_user');
    return {
      status: 'healthy',
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      version: result.rows[0].version.split(' ')[1],
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
};

// Initialize the secure pool
const pool = createSecurePool();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down database pool...');
  await pool.end();
  process.exit(0);
});

// Export secure database interface
module.exports = {
  query: secureQuery,
  transaction: secureTransaction,
  healthCheck,
  pool,
  // Export pool for legacy compatibility (deprecated)
  legacyPool: pool,
};
