const promClient = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
    register,
    prefix: 'chamasmart_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom Metrics

// HTTP Request Duration
const httpRequestDuration = new promClient.Histogram({
    name: 'chamasmart_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
});

// HTTP Request Total
const httpRequestTotal = new promClient.Counter({
    name: 'chamasmart_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

// Active Connections
const activeConnections = new promClient.Gauge({
    name: 'chamasmart_active_connections',
    help: 'Number of active HTTP connections',
});

// Database Query Duration
const databaseQueryDuration = new promClient.Histogram({
    name: 'chamasmart_database_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
});

// Database Connection Pool
const databasePoolSize = new promClient.Gauge({
    name: 'chamasmart_database_pool_size',
    help: 'Current size of database connection pool',
    labelNames: ['state'], // 'idle', 'active', 'waiting'
});

// Cache Hit/Miss
const cacheOperations = new promClient.Counter({
    name: 'chamasmart_cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'result'], // operation: 'get', 'set', 'delete'; result: 'hit', 'miss', 'success', 'error'
});

// Business Metrics
const contributionsTotal = new promClient.Counter({
    name: 'chamasmart_contributions_total',
    help: 'Total number of contributions recorded',
    labelNames: ['chama_type'],
});

const contributionsAmount = new promClient.Counter({
    name: 'chamasmart_contributions_amount_total',
    help: 'Total amount of contributions',
    labelNames: ['chama_type', 'currency'],
});

const activeUsers = new promClient.Gauge({
    name: 'chamasmart_active_users',
    help: 'Number of currently active users',
});

const socketConnections = new promClient.Gauge({
    name: 'chamasmart_socket_connections',
    help: 'Number of active WebSocket connections',
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(databaseQueryDuration);
register.registerMetric(databasePoolSize);
register.registerMetric(cacheOperations);
register.registerMetric(contributionsTotal);
register.registerMetric(contributionsAmount);
register.registerMetric(activeUsers);
register.registerMetric(socketConnections);

// Middleware to track HTTP metrics
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();

    // Increment active connections
    activeConnections.inc();

    // Track response
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path || 'unknown';
        const statusCode = res.statusCode;

        // Record duration
        httpRequestDuration.observe(
            {
                method: req.method,
                route,
                status_code: statusCode,
            },
            duration
        );

        // Increment request counter
        httpRequestTotal.inc({
            method: req.method,
            route,
            status_code: statusCode,
        });

        // Decrement active connections
        activeConnections.dec();

        // Log slow requests
        if (duration > 1) {
            logger.warn('Slow request detected', {
                method: req.method,
                route,
                duration: `${duration}s`,
                statusCode,
            });
        }
    });

    next();
};

// Metrics endpoint handler
const metricsEndpoint = async (req, res) => {
    try {
        const requiredToken = process.env.METRICS_AUTH_TOKEN;
        const isProduction = process.env.NODE_ENV === 'production';

        // Optional protection: when METRICS_AUTH_TOKEN is set in production,
        // require clients to provide it via the X-Metrics-Token header.
        if (isProduction && requiredToken) {
            const providedToken = req.headers['x-metrics-token'];

            if (!providedToken || providedToken !== requiredToken) {
                if (logger.logSecurityEvent) {
                    logger.logSecurityEvent('METRICS_UNAUTHORIZED_ACCESS', {
                        ip: req.ip,
                        userAgent: req.get('user-agent'),
                    });
                } else {
                    logger.warn('Unauthorized access to /metrics', {
                        ip: req.ip,
                        userAgent: req.get('user-agent'),
                    });
                }

                return res.status(403).end('Forbidden');
            }
        }

        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (error) {
        logger.logError(error, { context: 'metrics_endpoint' });
        res.status(500).end('Error generating metrics');
    }
};

// Health check endpoint handler
const healthCheckEndpoint = (req, res) => {
    try {
        const healthcheck = {
            uptime: process.uptime(),
            message: 'OK',
            timestamp: Date.now(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
        };

        res.status(200).json(healthcheck);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            uptime: process.uptime(),
            message: error.message || 'Health check failed',
            timestamp: Date.now(),
        });
    }
};

// Readiness check endpoint handler
const readinessCheckEndpoint = async (req, res) => {
    const checks = {
        database: false,
        redis: false,
    };

    try {
        // Check database connection
        const pool = require('../config/db');
        const dbResult = await pool.query('SELECT 1');
        checks.database = dbResult.rows.length > 0;

        // Check Redis connection (if configured)
        try {
            const redis = require('../config/redis');
            if (redis && typeof redis.ping === 'function') {
                await redis.ping();
                checks.redis = true;
            } else {
                checks.redis = true; // Redis not configured, skip check
            }
        } catch (redisError) {
            logger.warn('Redis health check failed', { error: redisError.message });
            checks.redis = false;
        }

        const isReady = checks.database && checks.redis;

        res.status(isReady ? 200 : 503).json({
            ready: isReady,
            checks,
            timestamp: Date.now(),
        });
    } catch (error) {
        logger.logError(error, { context: 'readiness_check' });
        res.status(503).json({
            ready: false,
            checks,
            error: error.message,
            timestamp: Date.now(),
        });
    }
};

module.exports = {
    metricsMiddleware,
    metricsEndpoint,
    healthCheckEndpoint,
    readinessCheckEndpoint,
    register,
    metrics: {
        httpRequestDuration,
        httpRequestTotal,
        activeConnections,
        databaseQueryDuration,
        databasePoolSize,
        cacheOperations,
        contributionsTotal,
        contributionsAmount,
        activeUsers,
        socketConnections,
    },
};
