const Redis = require('ioredis');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

class CacheManager {
    constructor() {
        this.redis = null;
        this.memoryCache = new Map();
        this.memoryCacheTTL = 60000; // 1 minute
        this.isRedisAvailable = false;

        this.initializeRedis();
        this.startMemoryCacheCleanup();
    }

    initializeRedis() {
        // Check if Redis is configured
        const redisConfig = this.getRedisConfig();

        if (!redisConfig) {
            logger.warn('Redis not configured, using in-memory cache only');
            return;
        }

        try {
            // Create Redis client (supports both single instance and cluster)
            if (redisConfig.cluster) {
                this.redis = new Redis.Cluster(redisConfig.nodes, {
                    redisOptions: {
                        password: redisConfig.password,
                        db: 0,
                    },
                    scaleReads: 'slave', // Read from replicas
                    maxRedirections: 16,
                    retryDelayOnFailover: 100,
                    retryDelayOnClusterDown: 300,
                });
                logger.info('Redis Cluster initialized', {
                    nodes: redisConfig.nodes.length
                });
            } else {
                this.redis = new Redis({
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password,
                    db: 0,
                    retryStrategy: (times) => {
                        const delay = Math.min(times * 50, 2000);
                        return delay;
                    },
                    maxRetriesPerRequest: 3,
                });
                logger.info('Redis client initialized', {
                    host: redisConfig.host,
                    port: redisConfig.port
                });
            }

            // Event handlers
            this.redis.on('connect', () => {
                this.isRedisAvailable = true;
                logger.info('Redis connected successfully');
            });

            this.redis.on('error', (err) => {
                this.isRedisAvailable = false;
                logger.error('Redis error', { error: err.message });

                // Track cache errors
                if (metrics?.cacheOperations) {
                    metrics.cacheOperations.inc({ operation: 'error', result: 'error' });
                }
            });

            this.redis.on('close', () => {
                this.isRedisAvailable = false;
                logger.warn('Redis connection closed');
            });

            this.redis.on('reconnecting', () => {
                logger.info('Redis reconnecting...');
            });

        } catch (error) {
            logger.error('Failed to initialize Redis', { error: error.message });
            this.redis = null;
        }
    }

    getRedisConfig() {
        // Check for cluster configuration
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

        // Check for single instance configuration
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

    // Multi-layer get (memory -> Redis -> null)
    async get(key) {
        const start = Date.now();

        try {
            // Layer 1: Check memory cache
            const memCached = this.memoryCache.get(key);
            if (memCached && Date.now() - memCached.timestamp < this.memoryCacheTTL) {
                if (metrics?.cacheOperations) {
                    metrics.cacheOperations.inc({ operation: 'get', result: 'hit_memory' });
                }
                logger.debug('Cache hit (memory)', { key, duration: Date.now() - start });
                return memCached.value;
            }

            // Layer 2: Check Redis
            if (this.isRedisAvailable && this.redis) {
                const cached = await this.redis.get(key);
                if (cached) {
                    const value = JSON.parse(cached);

                    // Populate memory cache
                    this.memoryCache.set(key, { value, timestamp: Date.now() });

                    if (metrics?.cacheOperations) {
                        metrics.cacheOperations.inc({ operation: 'get', result: 'hit_redis' });
                    }

                    logger.debug('Cache hit (Redis)', { key, duration: Date.now() - start });
                    return value;
                }
            }

            // Cache miss
            if (metrics?.cacheOperations) {
                metrics.cacheOperations.inc({ operation: 'get', result: 'miss' });
            }

            logger.debug('Cache miss', { key, duration: Date.now() - start });
            return null;

        } catch (error) {
            logger.error('Cache get error', { key, error: error.message });
            if (metrics?.cacheOperations) {
                metrics.cacheOperations.inc({ operation: 'get', result: 'error' });
            }
            return null;
        }
    }

    // Set with TTL (both memory and Redis)
    async set(key, value, ttl = 3600) {
        try {
            // Set in memory cache
            this.memoryCache.set(key, { value, timestamp: Date.now() });

            // Set in Redis
            if (this.isRedisAvailable && this.redis) {
                const serialized = JSON.stringify(value);
                await this.redis.setex(key, ttl, serialized);

                if (metrics?.cacheOperations) {
                    metrics.cacheOperations.inc({ operation: 'set', result: 'success' });
                }

                logger.debug('Cache set', { key, ttl });
            }

            return true;
        } catch (error) {
            logger.error('Cache set error', { key, error: error.message });
            if (metrics?.cacheOperations) {
                metrics.cacheOperations.inc({ operation: 'set', result: 'error' });
            }
            return false;
        }
    }

    // Cache-aside pattern: get or fetch and set
    async getOrSet(key, fetchFn, ttl = 3600) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }

        try {
            const value = await fetchFn();
            if (value !== null && value !== undefined) {
                await this.set(key, value, ttl);
            }
            return value;
        } catch (error) {
            logger.error('Cache getOrSet error', { key, error: error.message });
            throw error;
        }
    }

    // Delete cache entry
    async del(key) {
        try {
            // Delete from memory
            this.memoryCache.delete(key);

            // Delete from Redis
            if (this.isRedisAvailable && this.redis) {
                await this.redis.del(key);

                if (metrics?.cacheOperations) {
                    metrics.cacheOperations.inc({ operation: 'delete', result: 'success' });
                }
            }

            logger.debug('Cache deleted', { key });
            return true;
        } catch (error) {
            logger.error('Cache delete error', { key, error: error.message });
            return false;
        }
    }

    // Invalidate cache by pattern
    async invalidate(pattern) {
        try {
            // Clear memory cache matching pattern
            for (const key of this.memoryCache.keys()) {
                if (this.matchPattern(key, pattern)) {
                    this.memoryCache.delete(key);
                }
            }

            // Clear Redis cache matching pattern
            if (this.isRedisAvailable && this.redis) {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                    logger.info('Cache invalidated', { pattern, count: keys.length });
                }
            }

            return true;
        } catch (error) {
            logger.error('Cache invalidation error', { pattern, error: error.message });
            return false;
        }
    }

    // Batch get
    async mget(keys) {
        try {
            if (!this.isRedisAvailable || !this.redis) {
                return keys.map(() => null);
            }

            const values = await this.redis.mget(keys);
            return values.map(v => v ? JSON.parse(v) : null);
        } catch (error) {
            logger.error('Cache mget error', { error: error.message });
            return keys.map(() => null);
        }
    }

    // Batch set
    async mset(keyValuePairs, ttl = 3600) {
        try {
            if (!this.isRedisAvailable || !this.redis) {
                return false;
            }

            const pipeline = this.redis.pipeline();

            for (const [key, value] of Object.entries(keyValuePairs)) {
                const serialized = JSON.stringify(value);
                pipeline.setex(key, ttl, serialized);

                // Also set in memory cache
                this.memoryCache.set(key, { value, timestamp: Date.now() });
            }

            await pipeline.exec();
            logger.debug('Cache mset', { count: Object.keys(keyValuePairs).length });
            return true;
        } catch (error) {
            logger.error('Cache mset error', { error: error.message });
            return false;
        }
    }

    // Increment counter (useful for rate limiting, statistics)
    async incr(key, ttl = 3600) {
        try {
            if (!this.isRedisAvailable || !this.redis) {
                return 1;
            }

            const value = await this.redis.incr(key);

            // Set expiration if this is the first increment
            if (value === 1) {
                await this.redis.expire(key, ttl);
            }

            return value;
        } catch (error) {
            logger.error('Cache incr error', { key, error: error.message });
            return 1;
        }
    }

    // Helper: Match pattern (simple wildcard support)
    matchPattern(str, pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(str);
    }

    // Cleanup memory cache periodically
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
                logger.debug('Memory cache cleanup', { cleaned, remaining: this.memoryCache.size });
            }
        }, 60000); // Every minute
    }

    // Get cache statistics
    getStats() {
        return {
            memory: {
                size: this.memoryCache.size,
                ttl: this.memoryCacheTTL,
            },
            redis: {
                available: this.isRedisAvailable,
                type: this.redis instanceof Redis.Cluster ? 'cluster' : 'single',
            },
        };
    }

    // Graceful shutdown
    async quit() {
        if (this.redis) {
            await this.redis.quit();
            logger.info('Redis connection closed');
        }
    }
}

// Create singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;
