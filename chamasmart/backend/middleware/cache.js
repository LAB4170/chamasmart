const crypto = require('crypto');
const cache = require('../config/cache');
const logger = require('../utils/logger');

/**
 * Cache middleware for GET requests
 * Caches successful responses and serves from cache on subsequent requests
 */
const cacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = req => `api:${req.method}:${req.originalUrl}:${req.user?.user_id || 'anonymous'}`,
    condition = req => req.method === 'GET',
    invalidateOn = [], // Array of methods that should invalidate this cache
  } = options;

  return async (req, res, next) => {
    // Only cache if condition is met
    if (!condition(req)) {
      return next();
    }

    const key = keyGenerator(req);

    try {
      // Try to get from cache
      const cached = await cache.get(key);

      if (cached) {
        logger.debug('Serving from cache', { key, url: req.originalUrl });
        return res.json(cached);
      }

      // Intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = data => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(key, data, ttl).catch(err => {
            logger.error('Cache set error in middleware', {
              error: err.message,
              key,
            });
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', {
        error: error.message,
        url: req.originalUrl,
      });
      next(); // Continue without caching on error
    }
  };
};

/**
 * Cache invalidation middleware
 * Invalidates cache entries based on patterns when certain actions occur
 */
const cacheInvalidationMiddleware = patterns => async (req, res, next) => {
  // Store original send function
  const originalSend = res.send.bind(res);

  // Override send to invalidate cache after successful response
  res.send = function (data) {
    // Only invalidate on successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Invalidate cache patterns asynchronously
      Promise.all(
        patterns.map(pattern => {
          const resolvedPattern = typeof pattern === 'function' ? pattern(req) : pattern;
          return cache.invalidate(resolvedPattern);
        }),
      ).catch(err => {
        logger.error('Cache invalidation error', { error: err.message });
      });
    }

    return originalSend(data);
  };

  next();
};

/**
 * Predefined cache configurations for common endpoints
 */
const cacheConfigs = {
  // Chama details - cache for 5 minutes
  chamaDetails: {
    ttl: 300,
    keyGenerator: req => `chama:${req.params.chamaId || req.params.id}`,
    invalidatePatterns: [
      req => `chama:${req.params.chamaId || req.params.id}*`,
      'chamas:list:*',
    ],
  },

  // Chama list - cache for 2 minutes
  chamaList: {
    ttl: 120,
    keyGenerator: req => {
      const userId = req.user?.user_id || 'anonymous';
      const query = JSON.stringify(req.query);
      return `chamas:list:${userId}:${query}`;
    },
    invalidatePatterns: ['chamas:list:*'],
  },

  // User profile - cache for 10 minutes
  userProfile: {
    ttl: 600,
    keyGenerator: req => `user:${req.user?.user_id}:profile`,
    invalidatePatterns: [req => `user:${req.user?.user_id}:*`],
  },

  // Dashboard statistics - cache for 5 minutes
  dashboardStats: {
    ttl: 300,
    keyGenerator: req => {
      const userId = req.user?.user_id;
      const chamaId = req.params.chamaId || req.query.chamaId;
      return chamaId ? `stats:chama:${chamaId}` : `stats:user:${userId}`;
    },
    invalidatePatterns: [
      req => `stats:chama:${req.params.chamaId || req.query.chamaId}*`,
      req => `stats:user:${req.user?.user_id}*`,
    ],
  },

  // Contributions list - cache for 1 minute
  contributions: {
    ttl: 60,
    keyGenerator: req => {
      const chamaId = req.params.chamaId || req.query.chamaId;
      const query = JSON.stringify(req.query);
      return `contributions:${chamaId}:${query}`;
    },
    invalidatePatterns: [
      req => `contributions:${req.params.chamaId || req.body.chama_id}*`,
      req => `stats:chama:${req.params.chamaId || req.body.chama_id}*`,
      'chamas:list:*',
    ],
  },

  // Meetings list - cache for 5 minutes
  meetings: {
    ttl: 300,
    keyGenerator: req => {
      const chamaId = req.params.chamaId || req.query.chamaId;
      return `meetings:${chamaId}`;
    },
    invalidatePatterns: [
      req => `meetings:${req.params.chamaId || req.body.chama_id}*`,
    ],
  },

  // Loans list - cache for 2 minutes
  loans: {
    ttl: 120,
    keyGenerator: req => {
      const chamaId = req.params.chamaId || req.query.chamaId;
      const status = req.query.status || 'all';
      return `loans:${chamaId}:${status}`;
    },
    invalidatePatterns: [
      req => `loans:${req.params.chamaId || req.body.chama_id}*`,
      req => `stats:chama:${req.params.chamaId || req.body.chama_id}*`,
    ],
  },
};

/**
 * Helper function to create cache middleware with predefined config
 */
const createCacheMiddleware = configName => {
  const config = cacheConfigs[configName];
  if (!config) {
    throw new Error(`Unknown cache config: ${configName}`);
  }

  return cacheMiddleware({
    ttl: config.ttl,
    keyGenerator: config.keyGenerator,
  });
};

/**
 * Helper function to create invalidation middleware with predefined config
 */
const createInvalidationMiddleware = configName => {
  const config = cacheConfigs[configName];
  if (!config) {
    throw new Error(`Unknown cache config: ${configName}`);
  }

  return cacheInvalidationMiddleware(config.invalidatePatterns);
};

/**
 * Determine cache duration based on endpoint
 * @param {Object} req - Express request object
 * @returns {number} Cache duration in seconds (0 = no cache)
 */
const getCacheDuration = req => {
  // Don't cache non-GET requests
  if (req.method !== 'GET') {
    return 0;
  }

  // Public endpoints (high cache)
  if (
    req.path.includes('/public')
    || req.path.includes('/trending')
    || req.path === '/api/ping'
  ) {
    return 3600; // 1 hour
  }

  // User-specific endpoints (low cache)
  if (
    req.path.includes('/my-')
    || req.path.includes('/me')
    || req.path.includes('/user/')
  ) {
    return 300; // 5 minutes
  }

  // List endpoints (low cache)
  if (
    req.path.match(/.*\/\d+$/i) // Ends with ID (list endpoints)
    || req.path.includes('/list')
    || req.path.includes('/all')
  ) {
    return 300; // 5 minutes
  }

  // Default: no cache for mutations and dynamic content
  return 0;
};

/**
 * Generate ETag from response data
 * @param {*} data - Response data to hash
 * @returns {string} ETag hash
 */
const generateETag = data => {
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = crypto.createHash('md5').update(json).digest('hex');
    return `"${hash}"`;
  } catch (err) {
    logger.warn('Error generating ETag:', err.message);
    return `"${Date.now()}"`;
  }
};

/**
 * Cache Control Middleware
 * Adds intelligent HTTP caching headers based on endpoint type
 */
const cacheControlMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    const duration = getCacheDuration(req);

    if (duration > 0 && res.statusCode === 200) {
      // Cache for successful GET requests
      res.set('Cache-Control', `public, max-age=${duration}`);
      res.set('ETag', generateETag(data));
    } else if (res.statusCode === 200) {
      // Allow user-specific caching for user endpoints
      if (req.path.includes('/me') || req.path.includes('/my-')) {
        res.set('Cache-Control', 'private, max-age=300');
      } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    } else {
      // Don't cache error responses
      res.set('Cache-Control', 'no-store, no-cache');
    }

    // Set Vary header for content negotiation
    res.set('Vary', 'Accept, Authorization');

    // HTTP/1.0 compatibility
    res.set('Pragma', duration > 0 ? 'public' : 'no-cache');

    // Set Expires header for HTTP/1.0 clients
    if (duration > 0) {
      const expires = new Date(Date.now() + duration * 1000);
      res.set('Expires', expires.toUTCString());
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  cacheMiddleware,
  cacheInvalidationMiddleware,
  cacheConfigs,
  createCacheMiddleware,
  createInvalidationMiddleware,
  getCacheDuration,
  generateETag,
  cacheControlMiddleware,
};
