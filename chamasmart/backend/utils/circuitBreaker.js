const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');
const { metrics } = require('../middleware/metrics');

/**
 * Circuit Breaker Factory
 * Creates circuit breakers for external service calls with automatic failure detection
 */

// Default circuit breaker options
const defaultOptions = {
    timeout: 10000, // 10 seconds
    errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
    resetTimeout: 30000, // Try again after 30 seconds
    rollingCountTimeout: 10000, // 10 second rolling window
    rollingCountBuckets: 10, // 10 buckets in the window
    name: 'default',
    fallback: null,
};

// Track circuit breaker states
const circuitBreakers = new Map();

/**
 * Create a circuit breaker for a function
 * @param {Function} fn - The function to wrap
 * @param {Object} options - Circuit breaker options
 * @returns {CircuitBreaker} - The circuit breaker instance
 */
function createCircuitBreaker(fn, options = {}) {
    const config = { ...defaultOptions, ...options };

    const breaker = new CircuitBreaker(fn, config);

    // Event: Circuit opened (too many failures)
    breaker.on('open', () => {
        logger.warn('Circuit breaker opened', {
            name: config.name,
            reason: 'Too many failures',
        });

        if (metrics?.circuitBreakerState) {
            metrics.circuitBreakerState.set({ name: config.name, state: 'open' }, 1);
        }
    });

    // Event: Circuit half-opened (testing if service recovered)
    breaker.on('halfOpen', () => {
        logger.info('Circuit breaker half-open', {
            name: config.name,
            reason: 'Testing service recovery',
        });

        if (metrics?.circuitBreakerState) {
            metrics.circuitBreakerState.set({ name: config.name, state: 'half_open' }, 1);
        }
    });

    // Event: Circuit closed (service recovered)
    breaker.on('close', () => {
        logger.info('Circuit breaker closed', {
            name: config.name,
            reason: 'Service recovered',
        });

        if (metrics?.circuitBreakerState) {
            metrics.circuitBreakerState.set({ name: config.name, state: 'closed' }, 1);
        }
    });

    // Event: Fallback executed
    breaker.on('fallback', (result) => {
        logger.debug('Circuit breaker fallback executed', {
            name: config.name,
        });

        if (metrics?.circuitBreakerFallback) {
            metrics.circuitBreakerFallback.inc({ name: config.name });
        }
    });

    // Event: Request succeeded
    breaker.on('success', (result, latency) => {
        logger.debug('Circuit breaker request succeeded', {
            name: config.name,
            latency: `${latency}ms`,
        });
    });

    // Event: Request failed
    breaker.on('failure', (error) => {
        logger.error('Circuit breaker request failed', {
            name: config.name,
            error: error.message,
        });
    });

    // Event: Request rejected (circuit open)
    breaker.on('reject', () => {
        logger.warn('Circuit breaker rejected request', {
            name: config.name,
            reason: 'Circuit is open',
        });

        if (metrics?.circuitBreakerRejections) {
            metrics.circuitBreakerRejections.inc({ name: config.name });
        }
    });

    // Event: Request timeout
    breaker.on('timeout', () => {
        logger.warn('Circuit breaker request timeout', {
            name: config.name,
            timeout: `${config.timeout}ms`,
        });
    });

    // Store circuit breaker
    circuitBreakers.set(config.name, breaker);

    return breaker;
}

/**
 * Get circuit breaker by name
 * @param {string} name - Circuit breaker name
 * @returns {CircuitBreaker|null}
 */
function getCircuitBreaker(name) {
    return circuitBreakers.get(name) || null;
}

/**
 * Get all circuit breaker stats
 * @returns {Object} - Stats for all circuit breakers
 */
function getAllStats() {
    const stats = {};

    for (const [name, breaker] of circuitBreakers.entries()) {
        stats[name] = {
            state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
            stats: breaker.stats,
        };
    }

    return stats;
}

/**
 * Predefined circuit breakers for common services
 */

// Email service circuit breaker
const emailServiceBreaker = createCircuitBreaker(
    async (emailData) => {
        const emailService = require('../utils/emailService');
        return await emailService.sendEmail(emailData);
    },
    {
        name: 'email-service',
        timeout: 15000, // Email can take longer
        errorThresholdPercentage: 60, // More tolerant
        fallback: (emailData) => {
            logger.warn('Email service unavailable, queuing for later', {
                to: emailData.to,
                subject: emailData.subject,
            });
            // TODO: Queue email for retry
            return { queued: true };
        },
    }
);

// Database query circuit breaker (for critical queries)
const databaseBreaker = createCircuitBreaker(
    async (query, params) => {
        const dbRouter = require('../config/dbRouter');
        return await dbRouter.query(query, params);
    },
    {
        name: 'database',
        timeout: 5000,
        errorThresholdPercentage: 70,
        fallback: () => {
            throw new Error('Database is currently unavailable. Please try again later.');
        },
    }
);

// External API circuit breaker (for third-party services)
const externalApiBreaker = createCircuitBreaker(
    async (url, options) => {
        const axios = require('axios');
        const response = await axios(url, options);
        return response.data;
    },
    {
        name: 'external-api',
        timeout: 8000,
        errorThresholdPercentage: 50,
        fallback: () => {
            return {
                error: true,
                message: 'External service temporarily unavailable',
            };
        },
    }
);

// Cache service circuit breaker
const cacheBreaker = createCircuitBreaker(
    async (operation, ...args) => {
        const cache = require('../config/cache');
        return await cache[operation](...args);
    },
    {
        name: 'cache',
        timeout: 2000,
        errorThresholdPercentage: 80, // Very tolerant - cache failures shouldn't break the app
        fallback: () => {
            logger.debug('Cache unavailable, continuing without cache');
            return null;
        },
    }
);

module.exports = {
    createCircuitBreaker,
    getCircuitBreaker,
    getAllStats,
    // Predefined breakers
    emailServiceBreaker,
    databaseBreaker,
    externalApiBreaker,
    cacheBreaker,
};
