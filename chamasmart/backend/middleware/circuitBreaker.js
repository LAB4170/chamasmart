/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures from external dependencies
 */

const CircuitBreaker = require("opossum");
const logger = require("../utils/logger");
const config = require("../config/middleware.config");

/**
 * Circuit Breaker States
 */
const STATES = {
  CLOSED: "closed", // Normal operation
  OPEN: "open", // Failing, rejecting requests
  HALF_OPEN: "half_open", // Testing if service recovered
};

/**
 * Create a circuit breaker with default options
 */
const createCircuitBreaker = (operation, options = {}) => {
  const defaultOptions = {
    timeout: config.circuitBreaker.timeout,
    errorThresholdPercentage: config.circuitBreaker.errorThresholdPercentage,
    resetTimeout: config.circuitBreaker.resetTimeout,
    name: options.name || "unnamed-circuit",
    ...options,
  };

  const breaker = new CircuitBreaker(operation, defaultOptions);

  // Event listeners for monitoring
  breaker.on("open", () => {
    logger.warn(`Circuit breaker opened: ${defaultOptions.name}`);
  });

  breaker.on("halfOpen", () => {
    logger.info(`Circuit breaker half-open: ${defaultOptions.name}`);
  });

  breaker.on("close", () => {
    logger.info(`Circuit breaker closed: ${defaultOptions.name}`);
  });

  breaker.on("failure", (error) => {
    logger.error(`Circuit breaker failure: ${defaultOptions.name}`, {
      error: error.message,
    });
  });

  breaker.on("success", () => {
    logger.debug(`Circuit breaker success: ${defaultOptions.name}`);
  });

  return breaker;
};

/**
 * Redis Circuit Breaker
 */
let redisBreaker = null;

const initRedisBreaker = (redisClient) => {
  if (!redisClient) {
    logger.warn(
      "Redis client not provided, skipping circuit breaker initialization",
    );
    return null;
  }

  redisBreaker = createCircuitBreaker(
    async (operation) => {
      return await operation();
    },
    {
      name: "redis",
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    },
  );

  // Fallback function when circuit is open
  redisBreaker.fallback((operation) => {
    logger.warn("Redis circuit breaker open, using fallback");
    return null; // Return null to indicate Redis unavailable
  });

  return redisBreaker;
};

/**
 * Execute Redis operation with circuit breaker
 */
const executeRedisOperation = async (operation, fallbackValue = null) => {
  if (!redisBreaker) {
    logger.debug("Redis circuit breaker not initialized, executing directly");
    try {
      return await operation();
    } catch (error) {
      logger.error("Redis operation failed", { error: error.message });
      return fallbackValue;
    }
  }

  try {
    const result = await redisBreaker.fire(operation);
    return result !== null ? result : fallbackValue;
  } catch (error) {
    logger.error("Circuit breaker execution failed", { error: error.message });
    return fallbackValue;
  }
};

/**
 * Database Circuit Breaker
 */
let dbBreaker = null;

const initDatabaseBreaker = () => {
  dbBreaker = createCircuitBreaker(
    async (query, params) => {
      const pool = require("../config/db");
      return await pool.query(query, params);
    },
    {
      name: "database",
      timeout: 5000,
      errorThresholdPercentage: 80,
      resetTimeout: 60000,
    },
  );

  dbBreaker.fallback(() => {
    throw new Error("Database unavailable");
  });

  return dbBreaker;
};

/**
 * Execute database operation with circuit breaker
 */
const executeDatabaseOperation = async (query, params = []) => {
  if (!dbBreaker) {
    initDatabaseBreaker();
  }

  return await dbBreaker.fire(query, params);
};

/**
 * External API Circuit Breaker
 */
const createAPIBreaker = (apiName, options = {}) => {
  return createCircuitBreaker(
    async (requestFn) => {
      return await requestFn();
    },
    {
      name: `api-${apiName}`,
      timeout: options.timeout || 10000,
      errorThresholdPercentage: options.errorThreshold || 60,
      resetTimeout: options.resetTimeout || 60000,
    },
  );
};

/**
 * Get circuit breaker status
 */
const getCircuitBreakerStatus = () => {
  const status = {};

  if (redisBreaker) {
    status.redis = {
      state: redisBreaker.opened ? STATES.OPEN : STATES.CLOSED,
      stats: redisBreaker.stats,
    };
  }

  if (dbBreaker) {
    status.database = {
      state: dbBreaker.opened ? STATES.OPEN : STATES.CLOSED,
      stats: dbBreaker.stats,
    };
  }

  return status;
};

/**
 * Health check considering circuit breaker states
 */
const isHealthy = () => {
  const critical = [dbBreaker]; // Critical services

  for (const breaker of critical) {
    if (breaker && breaker.opened) {
      return false;
    }
  }

  return true;
};

module.exports = {
  STATES,
  createCircuitBreaker,
  initRedisBreaker,
  executeRedisOperation,
  initDatabaseBreaker,
  executeDatabaseOperation,
  createAPIBreaker,
  getCircuitBreakerStatus,
  isHealthy,
};
