const Redis = require('ioredis');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

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
    this.memoryCache = new Map();
    this.memoryCacheTTL = 60000; // 1 minute
    this.maxMemoryCacheSize = 1000; // LRU limit
    this.isRedisAvailable = false;
    this.pendingFetches = new Map(); // For stampede protection
    this.cacheVersion = process.env.CACHE_VERSION || 'v1';

    this.initializeRedis();
    this.startMemoryCacheCleanup();
  }

  initializeRedis() {
    const redisConfig = this.getRedisConfig();

    if (!redisConfig) {
      logger.warn('Redis not configured, using in-memory cache only');
      return;
    }

    try {
      if (redisConfig.cluster) {
        this.redis = new Redis.Cluster(redisConfig.nodes, {
          redisOptions: {
            password: redisConfig.password,
            db: 0,
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
          },
          scaleReads: 'slave',
          maxRedirections: 16,
          retryDelayOnFailover: 100,
          retryDelayOnClusterDown: 300,
          clusterRetryStrategy: times => Math.min(times * 100, 2000),
        });
        logger.info('Redis Cluster initialized', {
          nodes: redisConfig.nodes.length,
        });
      } else {
        this.redis = new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: 0,
          retryStrategy: times => {
            if (times > 10) {
              logger.error('Redis max retries exceeded');
              return null; // Stop retrying
            }
            return Math.min(times * 50, 2000);
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        });
        logger.info('Redis client initialized', {
          host: redisConfig.host,
          port: redisConfig.port,
        });
      }

      this.setupRedisEventHandlers();
    } catch (error) {
      logger.error('Failed to initialize Redis', { error: error.message });
      this.redis = null;
    }
  }

  setupRedisEventHandlers() {
    this.redis.on('connect', () => {
      this.isRedisAvailable = true;
      logger.info('Redis connected successfully');
    });

    this.redis.on('ready', () => {
      this.isRedisAvailable = true;
      logger.info('Redis ready to accept commands');
    });

    this.redis.on('error', err => {
      this.isRedisAvailable = false;
      logger.error('Redis error', { error: err.message });

      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: 'error',
          result: 'error',
        });
      }
    });

    this.redis.on('close', () => {
      this.isRedisAvailable = false;
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', delay => {
      logger.info('Redis reconnecting...', { delay });
    });

    this.redis.on('end', () => {
      this.isRedisAvailable = false;
      logger.warn('Redis connection ended');
    });
  }

  getRedisConfig() {
    if (process.env.REDIS_CLUSTER_NODES) {
      const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
        const [host, port] = node.trim().split(':');
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
        host: process.env.REDIS_HOST || 'localhost',
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

  // LRU eviction for memory cache
  evictOldestFromMemory() {
    if (this.memoryCache.size <= this.maxMemoryCacheSize) {
      return;
    }

    // Find oldest entry
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      logger.debug('Evicted from memory cache (LRU)', { key: oldestKey });
    }
  }

  // Multi-layer get with stampede protection
  async get(key, options = {}) {
    const start = Date.now();
    const versionedKey = this.versionKey(key);
    const customTTL = options.ttl || this.memoryCacheTTL;

    try {
      // Layer 1: Memory cache
      const memCached = this.memoryCache.get(versionedKey);
      if (memCached && Date.now() - memCached.timestamp < customTTL) {
        if (metrics?.cacheOperations) {
          metrics.cacheOperations.inc({
            operation: 'get',
            result: 'hit_memory',
          });
        }

        // Update access time for LRU
        memCached.timestamp = Date.now();

        logger.debug('Cache hit (memory)', {
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
          this.evictOldestFromMemory();
          this.memoryCache.set(versionedKey, {
            value,
            timestamp: Date.now(),
          });

          if (metrics?.cacheOperations) {
            metrics.cacheOperations.inc({
              operation: 'get',
              result: 'hit_redis',
            });
          }

          logger.debug('Cache hit (Redis)', {
            key,
            duration: Date.now() - start,
          });
          return value;
        }
      }

      // Cache miss
      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: 'get',
          result: 'miss',
        });
      }

      logger.debug('Cache miss', {
        key,
        duration: Date.now() - start,
      });
      return null;
    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: error.message,
      });
      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: 'get',
          result: 'error',
        });
      }
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    const versionedKey = this.versionKey(key);

    try {
      // Set in memory cache with LRU eviction
      this.evictOldestFromMemory();
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
            operation: 'set',
            result: 'success',
          });
        }

        logger.debug('Cache set', { key, ttl });
      }

      return true;
    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: error.message,
      });
      if (metrics?.cacheOperations) {
        metrics.cacheOperations.inc({
          operation: 'set',
          result: 'error',
        });
      }
      return false;
    }
  }

  // Cache-aside with stampede protection
  async getOrSet(key, fetchFn, ttl = 3600) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Stampede protection: check if fetch is already in progress
    const fetchKey = `fetch:${key}`;
    if (this.pendingFetches.has(fetchKey)) {
      logger.debug('Waiting for pending fetch', { key });
      return this.pendingFetches.get(fetchKey);
    }

    // Distributed lock for multi-instance deployments
    const lockKey = `lock:${this.versionKey(key)}`;
    const lockValue = crypto.randomBytes(16).toString('hex');
    const lockTTL = 10; // 10 seconds

    try {
      // Try to acquire lock
      let lockAcquired = false;

      if (this.isRedisAvailable && this.redis) {
        lockAcquired = await this.redis.set(
          lockKey,
          lockValue,
          'NX',
          'EX',
          lockTTL,
        );
      } else {
        // In-memory lock fallback
        lockAcquired = true;
      }

      if (!lockAcquired) {
        // Another instance is fetching, wait and retry
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try to get from cache again
        const retryCache = await this.get(key);
        if (retryCache !== null) {
          return retryCache;
        }

        // If still not available, fetch anyway (lock might have expired)
      }

      // Create promise for fetch
      const fetchPromise = (async () => {
        try {
          const value = await fetchFn();
          if (value !== null && value !== undefined) {
            await this.set(key, value, ttl);
          }
          return value;
        } finally {
          // Release lock
          if (this.isRedisAvailable && this.redis) {
            const script = `
                            if redis.call("get", KEYS[1]) == ARGV[1] then
                                return redis.call("del", KEYS[1])
                            else
                                return 0
                            end
                        `;
            await this.redis.eval(script, 1, lockKey, lockValue);
          }
          this.pendingFetches.delete(fetchKey);
        }
      })();

      this.pendingFetches.set(fetchKey, fetchPromise);
      return await fetchPromise;
    } catch (error) {
      this.pendingFetches.delete(fetchKey);
      logger.error('Cache getOrSet error', {
        key,
        error: error.message,
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
            operation: 'delete',
            result: 'success',
          });
        }
      }

      logger.debug('Cache deleted', { key });
      return true;
    } catch (error) {
      logger.error('Cache delete error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  // Non-blocking invalidation using SCAN
  async invalidate(pattern) {
    try {
      const versionedPattern = this.versionKey(pattern);

      // Clear memory cache
      let memoryCleared = 0;
      for (const key of this.memoryCache.keys()) {
        if (this.matchPattern(key, versionedPattern)) {
          this.memoryCache.delete(key);
          memoryCleared++;
        }
      }

      // Clear Redis using SCAN (non-blocking)
      if (this.isRedisAvailable && this.redis) {
        let cursor = '0';
        let totalCleared = 0;

        do {
          const [newCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            versionedPattern,
            'COUNT',
            100,
          );

          cursor = newCursor;

          if (keys.length > 0) {
            await this.redis.del(...keys);
            totalCleared += keys.length;
          }
        } while (cursor !== '0');

        logger.info('Cache invalidated', {
          pattern,
          redisCleared: totalCleared,
          memoryCleared,
        });
      }

      return true;
    } catch (error) {
      logger.error('Cache invalidation error', {
        pattern,
        error: error.message,
      });
      return false;
    }
  }

  async mget(keys) {
    try {
      if (!this.isRedisAvailable || !this.redis) {
        return keys.map(() => null);
      }

      const versionedKeys = keys.map(k => this.versionKey(k));
      const values = await this.redis.mget(versionedKeys);
      return values.map(v => (v ? JSON.parse(v) : null));
    } catch (error) {
      logger.error('Cache mget error', { error: error.message });
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
        this.evictOldestFromMemory();
        this.memoryCache.set(versionedKey, {
          value,
          timestamp: Date.now(),
        });
      }

      await pipeline.exec();
      logger.debug('Cache mset', {
        count: Object.keys(keyValuePairs).length,
      });
      return true;
    } catch (error) {
      logger.error('Cache mset error', { error: error.message });
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
      logger.error('Cache incr error', { key, error: error.message });
      return 1;
    }
  }

  // Advanced: Cache warming
  async warm(keysToWarm) {
    logger.info('Starting cache warming', {
      count: keysToWarm.length,
    });

    const results = await Promise.allSettled(
      keysToWarm.map(({ key, fetchFn, ttl }) => this.getOrSet(key, fetchFn, ttl)),
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    logger.info('Cache warming completed', {
      total: keysToWarm.length,
      successful,
    });

    return successful;
  }

  matchPattern(str, pattern) {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    );
    return regex.test(str);
  }

  startMemoryCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, value] of this.memoryCache.entries()) {
        if (now - value.timestamp > this.memoryCacheTTL) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug('Memory cache cleanup', {
          cleaned,
          remaining: this.memoryCache.size,
        });
      }
    }, 60000);
  }

  getStats() {
    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.maxMemoryCacheSize,
        ttl: this.memoryCacheTTL,
      },
      redis: {
        available: this.isRedisAvailable,
        type: this.redis instanceof Redis.Cluster ? 'cluster' : 'single',
      },
      version: this.cacheVersion,
      pendingFetches: this.pendingFetches.size,
    };
  }

  async quit() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis connection closed');
    }
  }
}

const cacheManager = new CacheManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await cacheManager.quit();
});

process.on('SIGINT', async () => {
  await cacheManager.quit();
});

module.exports = cacheManager;
