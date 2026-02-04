const Redis = require("ioredis");
const logger = require("../utils/logger");
const { metrics } = require("../middleware/metrics");
require("dotenv").config();

// Circuit breaker implementation
class CircuitBreaker {
  constructor(options = {}) {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttempt = 0;
    this.threshold = options.threshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.halfOpenTimeout = options.halfOpenTimeout || 10000; // 10 seconds
  }

  onFailure() {
    if (this.state === "CLOSED" || this.state === "HALF-OPEN") {
      this.failureCount++;

      if (this.failureCount >= this.threshold) {
        this.trip();
      }
    }
  }

  onSuccess() {
    if (this.state === "HALF-OPEN") {
      this.reset();
    } else if (this.state === "CLOSED" && this.failureCount > 0) {
      this.failureCount = 0;
    }
  }

  trip() {
    this.state = "OPEN";
    this.nextAttempt = Date.now() + this.resetTimeout;
    logger.error("Circuit breaker tripped", {
      state: "OPEN",
      nextAttempt: new Date(this.nextAttempt).toISOString(),
    });

    // Try to reset after timeout
    setTimeout(() => {
      this.state = "HALF-OPEN";
      logger.info("Circuit breaker half-open", { state: "HALF-OPEN" });

      // Auto-close if no failures in half-open state
      setTimeout(() => {
        if (this.state === "HALF-OPEN") {
          this.reset();
        }
      }, this.halfOpenTimeout);
    }, this.resetTimeout);
  }

  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    logger.info("Circuit breaker reset", { state: "CLOSED" });
  }

  isOpen() {
    if (this.state === "OPEN" && Date.now() > this.nextAttempt) {
      this.state = "HALF-OPEN";
      return false;
    }
    return this.state === "OPEN";
  }
}

// Mock Redis for development
class MockRedis {
  constructor() {
    this.store = new Map();
    this.connected = true;
    this.circuitBreaker = new CircuitBreaker();
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
    return "OK";
  }

  setex(key, ttl, value) {
    this.store.set(key, value);
    return "OK";
  }

  del(key) {
    this.store.delete(key);
    return 0;
  }

  exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  expire(key, ttl) {
    return 0;
  }

  ttl(key) {
    return -1;
  }

  keys(pattern) {
    return Array.from(this.store.keys());
  }

  flushall() {
    this.store.clear();
    return "OK";
  }

  ping() {
    return "PONG";
  }

  quit() {
    return "OK";
  }

  incr(key) {
    const value = this.store.get(key) || 0;
    this.store.set(key, value + 1);
    return value + 1;
  }

  incrby(key, value) {
    const currentValue = this.store.get(key) || 0;
    const newValue = parseInt(value) + currentValue;
    this.store.set(key, newValue);
    return newValue;
  }

  call(command, ...args) {
    if (command === "eval" || command === "evalsha") return [0, 0];
    return null;
  }
}

// Redis configuration with proper retry strategy
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3, // Allow retries
  lazyConnect: false, // Connect immediately
  connectTimeout: 10000, // Longer timeout
  commandTimeout: 5000,
  enableOfflineQueue: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Try to connect to Redis, fallback to mock if unavailable
let redis = new MockRedis();
let redisAvailable = false;
const circuitBreaker = new CircuitBreaker();

/**
 * Get the current Redis client (real or mock)
 */
function getRedisClient() {
  return redis;
}

const initializeRedis = async () => {
  try {
    const redisClient = new Redis(redisConfig);

    // Add metrics for command timing
    const originalSendCommand = redisClient.sendCommand.bind(redisClient);
    redisClient.sendCommand = async (command) => {
      const start = process.hrtime();
      const tags = { command: command.name };

      try {
        metrics.increment("redis.command.started", 1, tags);
        const result = await originalSendCommand(command);
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1e6;

        metrics.timing("redis.command.duration", duration, tags);
        metrics.increment("redis.command.completed", 1, {
          ...tags,
          status: "success",
        });

        circuitBreaker.onSuccess();
        return result;
      } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds * 1000 + nanoseconds / 1e6;

        metrics.timing("redis.command.duration", duration, {
          ...tags,
          error: error.code || "unknown",
        });
        metrics.increment("redis.command.failed", 1, {
          ...tags,
          status: "error",
          error: error.code || "unknown",
        });

        circuitBreaker.onFailure();
        throw error;
      }
    };

    // Test connection with timeout
    const pingPromise = redisClient.ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection timeout")), 5000),
    );

    await Promise.race([pingPromise, timeoutPromise]);

    logger.info("Redis connected successfully");
    metrics.gauge("redis.connection.status", 1);

    // Set up error handling
    redisClient.on("error", (error) => {
      metrics.increment("redis.error", 1, {
        type: error.code || "unknown",
        from: "event",
      });
      logger.error("Redis error", {
        error: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    });

    // Set up reconnection monitoring
    redisClient.on("connect", () => {
      logger.info("Redis connection established");
      metrics.gauge("redis.connection.status", 1);
      circuitBreaker.reset();
    });

    redisClient.on("reconnecting", () => {
      logger.warn("Redis reconnecting...");
      metrics.gauge("redis.connection.status", 0);
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
      metrics.gauge("redis.connection.status", 0);
    });

    redis = redisClient;
    redisAvailable = true;
    return true;
  } catch (error) {
    circuitBreaker.onFailure();
    metrics.increment("redis.connection.failed");

    logger.error("Failed to connect to Redis", {
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });

    logger.warn("Falling back to in-memory store");
    redis = new MockRedis();
    redisAvailable = false;
    return false;
  }
};

// Initialize Redis connection with error handling
initializeRedis()
  .then((status) => {
    if (status) {
      console.log("✅ Redis initialization completed successfully");
    } else {
      console.log("⚠️ Using mock Redis - some features may be limited");
    }
  })
  .catch((error) => {
    console.error("❌ Redis initialization failed:", error.message);
    console.log("⚠️ Using mock Redis - some features may be limited");
  });

// Test Redis connection
const testRedisConnection = async () => redisAvailable;

// Create a proxy to ensure exported redis client always points to the current active client
const redisProxy = new Proxy(
  {},
  {
    get: (target, prop) => {
      // If we're getting 'then' on a non-promise, return undefined to avoid weirdness with async/await
      if (prop === "then") return undefined;

      // Always get the latest client
      const currentClient = getRedisClient();
      const val = currentClient[prop];

      // Bind functions to the current client to preserve 'this'
      if (typeof val === "function") {
        return val.bind(currentClient);
      }
      return val;
    },
  },
);

module.exports = {
  redis: redisProxy,
  testRedisConnection,
  redisConfig,
  redisAvailable: () => redisAvailable,
  getRedisClient,
  initializeRedis,
};
