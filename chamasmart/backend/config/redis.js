const Redis = require("ioredis");
require("dotenv").config();

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

// Mock Redis for development when Redis is not available
const mockRedis = {
  get: async (key) => null,
  set: async (key, value, ...args) => "OK",
  setex: async (key, ttl, value) => "OK",
  del: async (key) => 0,
  exists: async (key) => 0,
  expire: async (key, ttl) => 0,
  ttl: async (key) => -1,
  keys: async (pattern) => [],
  flushall: async () => "OK",
  ping: async () => "PONG",
  quit: async () => "OK",
  incr: async (key) => 1,
  incrby: async (key, value) => parseInt(value) || 1,
};

// Try to connect to Redis, fallback to mock if unavailable
let redis = mockRedis;
let redisAvailable = false;

const initializeRedis = async () => {
  try {
    const redisClient = new Redis(redisConfig);

    // Wait for connection with proper timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Redis connection timeout"));
      }, 15000);

      redisClient.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });

      redisClient.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Test the connection
    const pong = await redisClient.ping();
    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }

    redis = redisClient;
    redisAvailable = true;
    console.log("✅ Redis connected successfully");

    redisClient.on("error", (err) => {
      console.warn("⚠️ Redis connection error:", err.message);
    });

    redisClient.on("close", () => {
      console.warn("⚠️ Redis connection closed");
    });

    return true;
  } catch (error) {
    console.error("❌ Redis connection failed:", error.message);
    console.log("🔄 Please ensure Redis server is running on localhost:6379");
    redis = mockRedis;
    redisAvailable = false;
    return false;
  }
};

// Initialize Redis connection
initializeRedis();

// Test Redis connection
const testRedisConnection = async () => {
  return redisAvailable;
};

// Get Redis client (with fallback)
const getRedisClient = () => {
  return redis;
};

module.exports = {
  redis: getRedisClient(),
  testRedisConnection,
  redisConfig,
  redisAvailable: () => redisAvailable,
  getRedisClient,
  initializeRedis,
};
