const { Pool } = require("pg");
require("dotenv").config();

const logger = require("../utils/logger");
const { metrics } = require("../middleware/metrics");

// Database configuration with read replica support
class DatabaseRouter {
    constructor() {
        // Primary database for writes
        this.primary = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_PRIMARY_HOST || process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: String(process.env.DB_PASSWORD),
            port: process.env.DB_PORT || 5432,
            max: 50, // Increased from 20 for high traffic
            min: 10, // Maintain minimum connections
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
            statement_timeout: 30000, // 30 seconds
        });

        // Read replicas (if configured)
        this.replicas = [];
        const replicaHosts = process.env.DB_REPLICA_HOSTS
            ? process.env.DB_REPLICA_HOSTS.split(',')
            : [];

        if (replicaHosts.length > 0) {
            replicaHosts.forEach((host, index) => {
                this.replicas.push(new Pool({
                    user: process.env.DB_USER,
                    host: host.trim(),
                    database: process.env.DB_NAME,
                    password: String(process.env.DB_PASSWORD),
                    port: process.env.DB_PORT || 5432,
                    max: 50,
                    min: 10,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 10000,
                    keepAlive: true,
                    keepAliveInitialDelayMillis: 10000,
                    statement_timeout: 30000,
                }));
                logger.info(`Read replica ${index + 1} configured`, { host: host.trim() });
            });
        }

        this.replicaIndex = 0;
        this.setupEventHandlers();
        this.testConnections();
    }

    setupEventHandlers() {
        // Primary pool events
        this.primary.on("connect", () => {
            if (metrics?.databasePoolSize) {
                metrics.databasePoolSize.set({ state: 'active' }, this.primary.totalCount);
            }
        });

        this.primary.on("error", (err) => {
            logger.error("Unexpected error on primary database pool", {
                error: err.message,
                stack: err.stack,
            });
        });

        // Replica pool events
        this.replicas.forEach((replica, index) => {
            replica.on("error", (err) => {
                logger.error(`Unexpected error on replica ${index + 1}`, {
                    error: err.message,
                    stack: err.stack,
                });
            });
        });
    }

    async testConnections() {
        // Test primary connection
        try {
            const client = await this.primary.connect();
            logger.info("Primary database connected successfully", {
                host: process.env.DB_PRIMARY_HOST || process.env.DB_HOST,
                database: process.env.DB_NAME,
                maxConnections: 50,
            });
            client.release();
        } catch (err) {
            logger.error("Error connecting to primary database", {
                error: err.message,
                host: process.env.DB_PRIMARY_HOST || process.env.DB_HOST,
            });
        }

        // Test replica connections
        for (let i = 0; i < this.replicas.length; i++) {
            try {
                const client = await this.replicas[i].connect();
                logger.info(`Read replica ${i + 1} connected successfully`);
                client.release();
            } catch (err) {
                logger.error(`Error connecting to replica ${i + 1}`, {
                    error: err.message,
                });
            }
        }
    }

    // Get read pool using round-robin load balancing
    getReadPool() {
        if (this.replicas.length === 0) {
            return this.primary; // Fallback to primary if no replicas
        }

        const pool = this.replicas[this.replicaIndex];
        this.replicaIndex = (this.replicaIndex + 1) % this.replicas.length;
        return pool;
    }

    // Get write pool (always primary)
    getWritePool() {
        return this.primary;
    }

    // Execute query with automatic routing
    async query(sql, params, options = {}) {
        const pool = options.write ? this.getWritePool() : this.getReadPool();
        const start = Date.now();
        const queryText = typeof sql === 'string' ? sql : sql.text;
        const queryType = queryText.trim().split(' ')[0].toUpperCase();

        try {
            const result = await pool.query(sql, params);
            const duration = Date.now() - start;

            // Track metrics
            if (metrics?.databaseQueryDuration) {
                const table = this.extractTableName(queryText);
                metrics.databaseQueryDuration.observe(
                    { query_type: queryType, table },
                    duration / 1000
                );
            }

            // Log slow queries
            if (duration > 1000) {
                logger.warn('Slow database query detected', {
                    query: queryText.substring(0, 200),
                    duration: `${duration}ms`,
                    rowCount: result.rowCount,
                    queryType,
                    pool: options.write ? 'primary' : 'replica',
                });
            } else if (duration > 100) {
                logger.debug('Query executed', {
                    duration: `${duration}ms`,
                    rowCount: result.rowCount,
                    queryType,
                });
            }

            return result;
        } catch (error) {
            logger.error('Database query error', {
                query: queryText.substring(0, 200),
                error: error.message,
                queryType,
            });
            throw error;
        }
    }

    // Execute transaction (always on primary)
    async transaction(callback) {
        const client = await this.primary.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Transaction error', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        } finally {
            client.release();
        }
    }

    // Extract table name from query for metrics
    extractTableName(query) {
        const match = query.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    // Get pool statistics
    getPoolStats() {
        const stats = {
            primary: {
                total: this.primary.totalCount,
                idle: this.primary.idleCount,
                waiting: this.primary.waitingCount,
            },
            replicas: this.replicas.map((replica, index) => ({
                index: index + 1,
                total: replica.totalCount,
                idle: replica.idleCount,
                waiting: replica.waitingCount,
            })),
        };

        // Update metrics
        if (metrics?.databasePoolSize) {
            metrics.databasePoolSize.set({ state: 'idle' }, this.primary.idleCount);
            metrics.databasePoolSize.set({ state: 'active' },
                this.primary.totalCount - this.primary.idleCount);
            metrics.databasePoolSize.set({ state: 'waiting' }, this.primary.waitingCount);
        }

        return stats;
    }

    // Graceful shutdown
    async end() {
        logger.info('Closing database connections...');

        await this.primary.end();
        logger.info('Primary database pool closed');

        for (let i = 0; i < this.replicas.length; i++) {
            await this.replicas[i].end();
            logger.info(`Replica ${i + 1} pool closed`);
        }
    }
}

// Create singleton instance
const dbRouter = new DatabaseRouter();

// Export both the router and the primary pool for backward compatibility
module.exports = dbRouter;
module.exports.pool = dbRouter.primary; // For legacy code
