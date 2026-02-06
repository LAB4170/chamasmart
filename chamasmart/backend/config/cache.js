const Redis = require("ioredis");
const crypto = require("crypto");
const LRU = require("lru-cache");
const logger = require("../utils/logger");
const { metrics } = require("../middleware/metrics");

// Cache configuration constants
const CACHE_CONFIG = {
  // Memory cache defaults
  MEMORY: {
    MAX_ITEMS: 1000,
    TTL_MS: 60 * 1000, // 1 minute
    MAX_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  },
  // Redis scan defaults
  SCAN: {
    BATCH_SIZE: 100,
    TIMEOUT_MS: 5000, // 5 seconds
  },
  // Lock defaults
  LOCK: {
    TTL_SECONDS: 10,
    RETRY_DELAY_MS: 100,
  },
  // Default TTLs (in seconds)
  TTL: {
    DEFAULT: 3600, // 1 hour
    SHORT: 300, // 5 minutes
    MEDIUM: 3600, // 1 hour
    LONG: 86400, // 1 day
  },
};

/**
 * Advanced Cache Manager with:
 * - Multi-layer caching (Memory + Redis)
 * - Cache stampede protection
 * - LRU eviction for memory cache
 * - SCAN-based invalidation (non-blocking)
 * - Cache versioning
 * - Distributed locking
 */

class CacheManager {
  constructor() {
    this.redis = null;
    this.cleanupHandlers = [];
    this.intervals = [];
    this.timeouts = [];
    this.pendingFetches = new Map();
    this.pendingLocks = new Map();
    this.circuitBreaker = {
      state: "CLOSED",
      failureCount: 0,
      nextAttempt: 0,
      threshold: 5,
      resetTimeout: 30000, // 30 seconds
    };

    // Initialize LRU cache with configuration
    this.memoryCache = new LRU({
      max: parseInt(
        process.env.MAX_MEMORY_CACHE_ITEMS || CACHE_CONFIG.MEMORY.MAX_ITEMS,
      ),
      ttl: parseInt(
        process.env.MEMORY_CACHE_TTL_MS || CACHE_CONFIG.MEMORY.TTL_MS,
      ),
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      allowStale: false,
      noDisposeOnSet: true,
      sizeCalculation: (value, key) =>
        Buffer.byteLength(JSON.stringify(value)) + Buffer.byteLength(key),
      maxSize: parseInt(
        process.env.MAX_MEMORY_CACHE_SIZE || CACHE_CONFIG.MEMORY.MAX_SIZE_BYTES,
      ),
    });

    this.isRedisAvailable = false;
    this.pendingFetches = new Map(); // For stampede protection
    this.cacheVersion = process.env.CACHE_VERSION || "v1";
    this.scanTimeout = parseInt(
      process.env.REDIS_SCAN_TIMEOUT_MS || CACHE_CONFIG.SCAN.TIMEOUT_MS,
    );
    this.scanBatchSize = parseInt(
      process.env.REDIS_SCAN_BATCH_SIZE || CACHE_CONFIG.SCAN.BATCH_SIZE,
    );
    this.lockTTL = CACHE_CONFIG.LOCK.TTL_SECONDS;
    this.retryDelay = CACHE_CONFIG.LOCK.RETRY_DELAY_MS;

    this.initializeRedis();
  }

  initializeRedis() {
    const redisConfig = this.getRedisConfig();

    if (!redisConfig) {
      logger.warn("Redis not configured, using in-memory cache only");
      return;
    }

    // Clean up any existing Redis client
    this.cleanupRedis();

    try {
      if (redisConfig.cluster) {
        this.redis = new Redis.Cluster(redisConfig.nodes, {
          redisOptions: {
            password: redisConfig.password,
            db: 0,
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
          },
          scaleReads: "slave",
          maxRedirections: 16,
          retryDelayOnFailover: 100,
          retryDelayOnClusterDown: 300,
          clusterRetryStrategy: (times) => Math.min(times * 100, 2000),
        });
        logger.info("Redis Cluster initialized", {
          nodes: redisConfig.nodes.length,
        });
      } else {
        this.redis = new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: 0,
          retryStrategy: (times) => {
            if (times > 10) {
              logger.error("Redis max retries exceeded");
              return null; // Stop retrying
            }
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });
        logger.info("Redis client initialized", {
          host: redisConfig.host,
          port: redisConfig.port,
        });
      }

      this.setupRedisEventHandlers();
    } catch (error) {
      logger.error("Failed to initialize Redis", { error: error.message });
      this.redis = null;
    }
  }

  setupRedisEventHandlers() {
    this.redis.on("connect", () => {
      this.isRedisAvailable = true;
      logger.info("Redis connected successfully");
    });

    this.redis.on("ready", () => {
      this.isRedisAvailable = true;
      logger.info("Redis ready to accept commands");
    });

    this.redis.on("error", (err) => {
      this.isRedisAvailable = false;
      logger.error("Redis error", { error: err.message });

      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: "error",
          result: "error",
        });
      }
    });

    this.redis.on("close", () => {
      this.isRedisAvailable = false;
      logger.warn("Redis connection closed");
    });

    this.redis.on("reconnecting", (delay) => {
      logger.info("Redis reconnecting...", { delay });
    });

    this.redis.on("end", () => {
      this.isRedisAvailable = false;
      logger.warn("Redis connection ended");
    });
  }

  getRedisConfig() {
    if (process.env.REDIS_CLUSTER_NODES) {
      const nodes = process.env.REDIS_CLUSTER_NODES.split(",").map((node) => {
        const [host, port] = node.trim().split(":");
        return { host, port: parseInt(port) || 6379 };
      });

      return {
        cluster: true,
        nodes,
        password: process.env.REDIS_PASSWORD,
      };
    }

    if (process.env.REDIS_HOST || process.env.REDIS_URL) {
      return {
        cluster: false,
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      };
    }

    return null;
  }

  // Version-aware key generation
  versionKey(key) {
    return `${this.cacheVersion}:${key}`;
  }

  // Multi-layer get with stampede protection
  async get(key, options = {}) {
    const start = Date.now();
    const versionedKey = this.versionKey(key);
    const customTTL = options.ttl || this.memoryCache.options.ttl;

    try {
      // Layer 1: Memory cache
      const memCached = this.memoryCache.get(versionedKey);
      if (memCached && Date.now() - memCached.timestamp < customTTL) {
        if (metrics?.cacheOperations) {
          metrics.cacheOperations.inc({
            operation: "get",
            result: "hit_memory",
          });
        }

        // Update access time for LRU
        memCached.timestamp = Date.now();

        logger.debug("Cache hit (memory)", {
          key,
          duration: Date.now() - start,
        });
        return memCached.value;
      }

      // Layer 2: Redis cache
      if (this.isRedisAvailable && this.redis) {
        const cached = await this.redis.get(versionedKey);
        if (cached) {
          const value = JSON.parse(cached);

          // Populate memory cache with LRU eviction
          this.memoryCache.set(versionedKey, {
            value,
            timestamp: Date.now(),
          });

          if (metrics?.cacheOperations) {
            metrics.cacheOperations.inc({
              operation: "get",
              result: "hit_redis",
            });
          }

          logger.debug("Cache hit (Redis)", {
            key,
            duration: Date.now() - start,
          });
          return value;
        }
      }

      // Cache miss
      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: "get",
          result: "miss",
        });
      }

      logger.debug("Cache miss", {
        key,
        duration: Date.now() - start,
      });
      return null;
    } catch (error) {
      logger.error("Cache get error", {
        key,
        error: error.message,
      });
      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: "get",
          result: "error",
        });
      }
      return null;
    }
  }

  // Validate cache entry size
  validateCacheEntry(key, value) {
    // Maximum key size: 1KB
    if (Buffer.byteLength(key, "utf8") > 1024) {
      throw new Error(`Cache key too large: ${key.length} bytes`);
    }

    // Maximum value size: 1MB (configurable via env)
    const maxValueSize = parseInt(
      process.env.MAX_CACHE_VALUE_SIZE || "1048576",
    ); // 1MB default
    const valueSize = Buffer.byteLength(JSON.stringify(value), "utf8");

    if (valueSize > maxValueSize) {
      throw new Error(
        `Cache value too large: ${valueSize} bytes (max: ${maxValueSize})`,
      );
    }

    return true;
  }

  async set(key, value, ttl = 3600) {
    const versionedKey = this.versionKey(key);

    try {
      // Validate cache entry size
      this.validateCacheEntry(key, value);

      // Set in memory cache with LRU eviction
      this.memoryCache.set(versionedKey, {
        value,
        timestamp: Date.now(),
      });

      // Set in Redis
      if (this.isRedisAvailable && this.redis) {
        const serialized = JSON.stringify(value);
        await this.redis.setex(versionedKey, ttl, serialized);

        if (metrics?.cacheOperations) {
          metrics.cacheOperations.inc({
            operation: "set",
            result: "success",
          });
        }

        logger.debug("Cache set", { key, ttl });
      }

      return true;
    } catch (error) {
      logger.error("Cache set error", {
        key,
        error: error.message,
      });
      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: "set",
          result: "error",
        });
      }
      return false;
    }
  }

  // Cache-aside with stampede protection
  async getOrSet(key, fetchFn, ttl = 3600) {
    // First, try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const fetchKey = `fetch:${key}`;
    const versionedKey = this.versionKey(key);

    // Check if there's already a pending fetch for this key
    if (this.pendingFetches.has(fetchKey)) {
      logger.debug("Waiting for pending fetch", { key });
      try {
        return await this.pendingFetches.get(fetchKey);
      } catch (error) {
        // If the pending fetch fails, we'll try to fetch again
        logger.warn("Pending fetch failed, retrying", {
          key,
          error: error.message,
        });
      }
    }

    // Distributed lock for multi-instance deployments
    const lockKey = `lock:${versionedKey}`;
    const lockValue = crypto.randomBytes(16).toString("hex");
    const lockTTL = 10; // 10 seconds
    let lockAcquired = false;
    let fetchPromise = null;

    try {
      // Create the fetch promise first to ensure it's set before any awaits
      fetchPromise = (async () => {
        try {
          // Try to get from cache again in case it was set while we were waiting
          const recheckCache = await this.get(key);
          if (recheckCache !== null) {
            return recheckCache;
          }

          // Try to acquire lock
          if (this.isRedisAvailable && this.redis) {
            lockAcquired = await this.redis.set(
              lockKey,
              lockValue,
              "NX",
              "EX",
              lockTTL,
            );
          } else {
            // In-memory lock fallback
            lockAcquired = true;
          }

          if (!lockAcquired) {
            // Another instance is fetching, wait and retry
            await new Promise((resolve) => setTimeout(resolve, 100));
            const retryCache = await this.get(key);
            if (retryCache !== null) {
              return retryCache;
            }
            // If still not available, continue to fetch (lock might have expired)
          }

          // Execute the fetch function
          const value = await fetchFn();

          // Only set the cache if we got a valid value
          if (value !== null && value !== undefined) {
            await this.set(key, value, ttl);
          }

          return value;
        } finally {
          // Always clean up the lock and pending fetch
          try {
            if (lockAcquired && this.isRedisAvailable && this.redis) {
              const script = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                  return redis.call("del", KEYS[1])
                end
                return 0
              `;
              await this.redis
                .eval(script, 1, lockKey, lockValue)
                .catch((err) => {
                  logger.error("Failed to release lock", {
                    key,
                    error: err.message,
                  });
                });
            }
          } finally {
            // Always remove from pendingFetches, even if there was an error
            this.pendingFetches.delete(fetchKey);
          }
        }
      })();

      // Set the pending fetch before any awaits
      this.pendingFetches.set(fetchKey, fetchPromise);

      // Now await the result (this will throw if there's an error)
      return await fetchPromise;
    } catch (error) {
      // Clean up in case of error
      this.pendingFetches.delete(fetchKey);
      logger.error("Cache getOrSet error", {
        key,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async del(key) {
    const versionedKey = this.versionKey(key);

    try {
      this.memoryCache.delete(versionedKey);

      if (this.isRedisAvailable && this.redis) {
        await this.redis.del(versionedKey);

        if (metrics?.cacheOperations) {
          metrics.cacheOperations.inc({
            operation: "delete",
            result: "success",
          });
        }
      }

      logger.debug("Cache deleted", { key });
      return true;
    } catch (error) {
      logger.error("Cache delete error", {
        key,
        error: error.message,
      });
      return false;
    }
  }

  // Non-blocking invalidation using SCAN with backpressure
  async invalidate(pattern, timeoutMs = this.scanTimeout) {
    if (!this.redis) return { processed: 0, remaining: 0 };

    const versionedPattern = this.versionKey(pattern);
    let cursor = "0";
    let processed = 0;
    const startTime = Date.now();
    let batchCount = 0;
    const batchSize = this.scanBatchSize;

    try {
      do {
        // Check if we've exceeded our time budget
        if (Date.now() - startTime > timeoutMs) {
          logger.warn("SCAN operation timed out", {
            pattern,
            batchCount,
            durationMs: Date.now() - startTime,
          });
          break;
        }

        // Process a batch of keys
        const [newCursor, scanKeys] = await this.redis.scan(
          cursor,
          "MATCH",
          versionedPattern,
          "COUNT",
          batchSize,
        );

        cursor = newCursor;

        if (scanKeys.length > 0) {
          // Process keys in smaller chunks to prevent blocking
          const chunkSize = 100;
          for (let i = 0; i < scanKeys.length; i += chunkSize) {
            const chunk = scanKeys.slice(i, i + chunkSize);
            await this.redis.del(...chunk);
            processed += chunk.length;
          }
        }

        batchCount++;

        // Small delay to prevent event loop blocking
        if (batchCount % 10 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      } while (cursor !== "0");

      return { processed, remaining: cursor !== "0" };
    } catch (error) {
      logger.error("Error during cache invalidation", {
        error: error.message,
        pattern,
        processed,
        batchCount,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  async mget(keys) {
    try {
      if (!this.isRedisAvailable || !this.redis) {
        return keys.map(() => null);
      }

      const versionedKeys = keys.map((k) => this.versionKey(k));
      const values = await this.redis.mget(versionedKeys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      logger.error("Cache mget error", { error: error.message });
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs, ttl = 3600) {
    try {
      if (!this.isRedisAvailable || !this.redis) {
        return false;
      }

      const pipeline = this.redis.pipeline();

      for (const [key, value] of Object.entries(keyValuePairs)) {
        const versionedKey = this.versionKey(key);
        const serialized = JSON.stringify(value);
        pipeline.setex(versionedKey, ttl, serialized);

        // Also set in memory cache
        this.memoryCache.set(versionedKey, {
          value,
          timestamp: Date.now(),
        });
      }

      await pipeline.exec();
      logger.debug("Cache mset", {
        count: Object.keys(keyValuePairs).length,
      });
      return true;
    } catch (error) {
      logger.error("Cache mset error", { error: error.message });
      return false;
    }
  }

  async incr(key, ttl = 3600) {
    const versionedKey = this.versionKey(key);

    try {
      if (!this.isRedisAvailable || !this.redis) {
        return 1;
      }

      const value = await this.redis.incr(versionedKey);

      if (value === 1) {
        await this.redis.expire(versionedKey, ttl);
      }

      return value;
    } catch (error) {
      logger.error("Cache incr error", { key, error: error.message });
      return 1;
    }
  }

  // Advanced: Cache warming
  async warm(keysToWarm) {
    logger.info("Starting cache warming", { count: keysToWarm.length });

    const results = await Promise.allSettled(
      keysToWarm.map(({ key, fetchFn, ttl }) =>
        this.getOrSet(key, fetchFn, ttl),
      ),
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    logger.info("Cache warming completed", {
      total: keysToWarm.length,
      successful,
    });

    return successful;
  }

  matchPattern(str, pattern) {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
    );
    return regex.test(str);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Clear all intervals and timeouts
    this.intervals.forEach(clearInterval);
    this.timeouts.forEach(clearTimeout);
    this.intervals = [];
    this.timeouts = [];

    // Clean up Redis
    await this.cleanupRedis();
  }

  /**
   * Clean up Redis client
   */
  async cleanupRedis() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (err) {
        logger.warn("Error while closing Redis connection", {
          error: err.message,
        });
      } finally {
        this.redis = null;
        this.isRedisAvailable = false;
      }
    }
  }

  // Circuit breaker methods
  isCircuitOpen() {
    if (this.circuitBreaker.state === "OPEN") {
      if (Date.now() > this.circuitBreaker.nextAttempt) {
        this.circuitBreaker.state = "HALF-OPEN";
        return false;
      }
      return true;
    }
    return false;
  }

  recordFailure() {
    this.circuitBreaker.failureCount++;

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = "OPEN";
      this.circuitBreaker.nextAttempt =
        Date.now() + this.circuitBreaker.resetTimeout;
      logger.error("Circuit breaker tripped", {
        state: "OPEN",
        nextAttempt: new Date(this.circuitBreaker.nextAttempt).toISOString(),
      });
    }
  }

  recordSuccess() {
    this.circuitBreaker.failureCount = 0;
    if (this.circuitBreaker.state === "HALF-OPEN") {
      this.circuitBreaker.state = "CLOSED";
      logger.info("Circuit breaker reset", { state: "CLOSED" });
    }
  }

  // Memory cache cleanup is now handled automatically by lru-cache

  getStats() {
    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.maxMemoryCacheSize,
        ttl: this.memoryCacheTTL,
      },
      redis: {
        available: this.isRedisAvailable,
        type: this.redis instanceof Redis.Cluster ? "cluster" : "single",
      },
      version: this.cacheVersion,
      pendingFetches: this.pendingFetches.size,
    };
  }

  async quit() {
    if (this.redis) {
      await this.redis.quit();
      logger.info("Redis connection closed");
    }
  }
}

const cacheManager = new CacheManager();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await cacheManager.quit();
});

process.on("SIGINT", async () => {
  await cacheManager.quit();
});

module.exports = cacheManager;
