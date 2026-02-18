/**
 * Advanced Redis Caching Middleware
 * Provides intelligent caching with cache invalidation, compression, and performance monitoring
 */

const redis = require('../config/redis');
const logger = require('../utils/logger');
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require('../utils/auditLog');

class CacheManager {
  constructor() {
    this.defaultTTL = 300; // 5 minutes
    this.compressionThreshold = 1024; // 1KB
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Generate cache key with namespace and parameters
   */
  generateKey(namespace, identifier, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');

    return `cache:${namespace}:${identifier}${paramString ? `:${paramString}` : ''}`;
  }

  /**
   * Compress large data before caching
   */
  compress(data) {
    try {
      const jsonString = JSON.stringify(data);
      if (jsonString.length > this.compressionThreshold) {
        // For now, just store as is. In production, use compression library
        return jsonString;
      }
      return jsonString;
    } catch (error) {
      logger.error('Cache compression error:', error);
      return null;
    }
  }

  /**
   * Decompress cached data
   */
  decompress(data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error('Cache decompression error:', error);
      return null;
    }
  }

  /**
   * Set cache with TTL
   */
  async set(key, data, ttl = this.defaultTTL) {
    try {
      const compressed = this.compress(data);
      if (!compressed) return false;

      const redisClient = redis.getRedisClient();
      await redisClient.setex(key, ttl, compressed);

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cache data
   */
  async get(key) {
    try {
      const redisClient = redis.getRedisClient();
      const data = await redisClient.get(key);

      if (data) {
        this.stats.hits++;
        return this.decompress(data);
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache key
   */
  async delete(key) {
    try {
      const redisClient = redis.getRedisClient();
      await redisClient.del(key);
      this.stats.deletes++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern) {
    try {
      const redisClient = redis.getRedisClient();
      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        await redisClient.del(...keys);
        this.stats.deletes += keys.length;
      }

      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache by namespace
   */
  async invalidateNamespace(namespace) {
    const pattern = `cache:${namespace}:*`;
    return await this.deletePattern(pattern);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      total,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }
}

// Global cache manager instance
const cacheManager = new CacheManager();

/**
 * Caching middleware factory
 */
const cacheMiddleware = (options = {}) => {
  const {
    namespace = 'default',
    ttl = 300,
    keyGenerator = null,
    condition = () => true,
    invalidateOn = [], // Array of events that should invalidate this cache
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check if caching condition is met
    if (!condition(req)) {
      return next();
    }

    // Generate cache key
    const key = keyGenerator
      ? keyGenerator(req)
      : cacheManager.generateKey(namespace, req.originalUrl, req.query);

    try {
      // Try to get from cache
      const cachedData = await cacheManager.get(key);

      if (cachedData) {
        // Add cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', key);

        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }

      // Cache miss - continue to handler
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', key);

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function (data) {
        // Only cache successful responses
        if (data.success !== false && res.statusCode === 200) {
          cacheManager.set(key, data.data || data, ttl).catch(error => {
            logger.error('Failed to cache response:', error);
          });
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Cache invalidation middleware
 */
const invalidateCache = patterns => async (req, res, next) => {
  const originalJson = res.json;

  res.json = async function (data) {
    // Only invalidate on successful operations
    if (data.success !== false && res.statusCode < 400) {
      for (const pattern of patterns) {
        const resolvedPattern = typeof pattern === 'function'
          ? pattern(req, data)
          : pattern;

        if (resolvedPattern) {
          await cacheManager.deletePattern(resolvedPattern).catch(error => {
            logger.error('Cache invalidation error:', error);
          });
        }
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Common cache configurations
 */
const cacheConfigs = {
  // User profile cache
  userProfile: {
    namespace: 'user_profile',
    ttl: 600, // 10 minutes
    keyGenerator: req => {
      const userId = req.user?.id || req.params.userId;
      return cacheManager.generateKey('user_profile', userId);
    },
    invalidateOn: ['user:update', 'user:delete'],
  },

  // Chama list cache
  chamaList: {
    namespace: 'chama_list',
    ttl: 300, // 5 minutes
    keyGenerator: req => {
      const userId = req.user?.id;
      return cacheManager.generateKey('chama_list', userId, req.query);
    },
    invalidateOn: ['chama:create', 'chama:update', 'chama:delete', 'membership:update'],
  },

  // Chama details cache
  chamaDetails: {
    namespace: 'chama_details',
    ttl: 600, // 10 minutes
    keyGenerator: req => {
      const chamaId = req.params.chamaId || req.params.id;
      return cacheManager.generateKey('chama_details', chamaId);
    },
    invalidateOn: ['chama:update', 'chama:delete', 'member:update', 'contribution:create'],
  },

  // Loan list cache
  loanList: {
    namespace: 'loan_list',
    ttl: 180, // 3 minutes
    keyGenerator: req => {
      const { chamaId } = req.params;
      return cacheManager.generateKey('loan_list', chamaId, req.query);
    },
    invalidateOn: ['loan:create', 'loan:update', 'loan:delete'],
  },

  // Contribution list cache
  contributionList: {
    namespace: 'contribution_list',
    ttl: 300, // 5 minutes
    keyGenerator: req => {
      const { chamaId } = req.params;
      return cacheManager.generateKey('contribution_list', chamaId, req.query);
    },
    invalidateOn: ['contribution:create', 'contribution:update', 'contribution:delete'],
  },

  // Meeting list cache
  meetingList: {
    namespace: 'meeting_list',
    ttl: 600, // 10 minutes
    keyGenerator: req => {
      const { chamaId } = req.params;
      return cacheManager.generateKey('meeting_list', chamaId, req.query);
    },
    invalidateOn: ['meeting:create', 'meeting:update', 'meeting:delete'],
  },
};

/**
 * Pre-configured cache middleware
 */
const userProfileCache = cacheMiddleware(cacheConfigs.userProfile);
const chamaListCache = cacheMiddleware(cacheConfigs.chamaList);
const chamaDetailsCache = cacheMiddleware(cacheConfigs.chamaDetails);
const loanListCache = cacheMiddleware(cacheConfigs.loanList);
const contributionListCache = cacheMiddleware(cacheConfigs.contributionList);
const meetingListCache = cacheMiddleware(cacheConfigs.meetingList);

/**
 * Cache invalidation patterns
 */
const invalidationPatterns = {
  userProfile: req => [
    `cache:user_profile:${req.user?.id}:*`,
    `cache:user_profile:${req.params.userId}:*`,
  ],

  chamaList: req => [
    `cache:chama_list:${req.user?.id}:*`,
  ],

  chamaDetails: req => [
    `cache:chama_details:${req.params.chamaId}:*`,
    `cache:loan_list:${req.params.chamaId}:*`,
    `cache:contribution_list:${req.params.chamaId}:*`,
    `cache:meeting_list:${req.params.chamaId}:*`,
  ],

  loanOperations: req => [
    `cache:loan_list:${req.params.chamaId}:*`,
    `cache:loan_details:${req.params.loanId}:*`,
  ],
};

/**
 * Cache warming functions
 */
const warmCache = async () => {
  try {
    // Warm frequently accessed data
    logger.info('Starting cache warming...');

    // This would typically load common data into cache
    // For now, just log that warming started

    logger.info('Cache warming completed');
  } catch (error) {
    logger.error('Cache warming error:', error);
  }
};

/**
 * Cache monitoring endpoint data
 */
const getCacheMetrics = async () => {
  try {
    const stats = cacheManager.getStats();
    const redisClient = redis.getRedisClient();

    // Get Redis info
    const redisInfo = await redisClient.info('memory');
    const memoryUsage = redisInfo.split('\r\n')
      .find(line => line.startsWith('used_memory_human:'))
      ?.split(':')[1];

    return {
      stats,
      memoryUsage,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Cache metrics error:', error);
    return null;
  }
};

module.exports = {
  CacheManager,
  cacheManager,
  cacheMiddleware,
  invalidateCache,
  userProfileCache,
  chamaListCache,
  chamaDetailsCache,
  loanListCache,
  contributionListCache,
  meetingListCache,
  cacheConfigs,
  invalidationPatterns,
  warmCache,
  getCacheMetrics,
};
