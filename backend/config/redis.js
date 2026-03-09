const Redis = require("ioredis");
const logger = require("../utils/logger");
require("dotenv").config();

// Circuit breaker implementation
class CircuitBreaker {
  constructor(options = {}) {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttempt = 0;
    this.threshold = options.threshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
  }
  onFailure() {
    if (this.state === "CLOSED" || this.state === "HALF-OPEN") {
      this.failureCount++;
      if (this.failureCount >= this.threshold) this.trip();
    }
  }
  onSuccess() {
    if (this.state === "HALF-OPEN") this.reset();
    else if (this.state === "CLOSED" && this.failureCount > 0) this.failureCount = 0;
  }
  trip() {
    this.state = "OPEN";
    this.nextAttempt = Date.now() + this.resetTimeout;
    logger.error("Redis Circuit breaker tripped", { state: "OPEN" });
    setTimeout(() => { this.state = "HALF-OPEN"; }, this.resetTimeout);
  }
  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
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
  }
  get(key) { return this.store.get(key); }
  set(key, value) { this.store.set(key, value); return "OK"; }
  setex(key, ttl, value) { this.store.set(key, value); return "OK"; }
  del(key) { this.store.delete(key); return 0; }
  exists(key) { return this.store.has(key) ? 1 : 0; }
  expire(key, ttl) { return 0; }
  ttl(key) { return -1; }
  keys(pattern) { return Array.from(this.store.keys()); }
  flushall() { this.store.clear(); return "OK"; }
  ping() { return "PONG"; }
  quit() { return "OK"; }
  async incr(key) {
    const val = (this.store.get(key) || 0) + 1;
    this.store.set(key, val);
    return val;
  }
  async incrby(key, val) {
    const current = (this.store.get(key) || 0) + parseInt(val);
    this.store.set(key, current);
    return current;
  }
  async call(command, ...args) {
    const cmd = command.toLowerCase();
    if (cmd === 'script' && args[0]?.toLowerCase() === 'load') return "mock_sha";
    if (cmd === "eval" || cmd === "evalsha") return [1, 15 * 60 * 1000];
    return null;
  }
}

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  maxRetriesPerRequest: 1, // Fail fast
  lazyConnect: true,
  connectTimeout: 2000,
  commandTimeout: 2000,
  enableOfflineQueue: false, // Critical to prevent hangs
  retryStrategy: (times) => null, // Don't retry automatically, let initializeRedis handle it
};

let redis = new MockRedis();
let redisAvailable = false;
const circuitBreaker = new CircuitBreaker();

function getRedisClient() { return redis; }

const initializeRedis = async () => {
  if (!redisConfig.host) {
    logger.info("Redis host not configured, using mock store");
    return false;
  }

  try {
    const redisClient = new Redis(redisConfig);

    // Immediate error handler
    redisClient.on("error", (err) => {
      // Only log if we are supposedly available
      if (redisAvailable) logger.error("Redis Error", { message: err.message });
    });

    // Test connection
    await redisClient.connect().catch(() => {});
    const ping = await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
    ]);

    if (ping === "PONG") {
      logger.info("Redis connected successfully");
      redis = redisClient;
      redisAvailable = true;
      return true;
    }
    throw new Error("Ping failed");
  } catch (err) {
    logger.warn("Redis unavailable, using mock store", { error: err.message });
    redis = new MockRedis();
    redisAvailable = false;
    return false;
  }
};

// Start initialization but don't block
initializeRedis().then(status => {
    if (!status) console.log("⚠️ Using mock Redis");
});

const redisProxy = new Proxy({}, {
  get: (target, prop) => {
    if (prop === "then") return undefined;
    const client = getRedisClient();
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  }
});

module.exports = {
  redis: redisProxy,
  testRedisConnection: async () => redisAvailable,
  redisConfig,
  redisAvailable: () => redisAvailable,
  initializeRedis,
};
