const { Pool } = require("pg");
require("dotenv").config();

const logger = require("../utils/logger");
const { metrics } = require("../middleware/metrics");

/**
 * Advanced Database Router with:
 * - Automatic read/write routing
 * - Replica failover and health checks
 * - Connection pooling with monitoring
 * - Transaction support
 * - Query performance tracking
 */
class DatabaseRouter {
  constructor() {
    this.primary = this.createPool("primary", {
      host: process.env.DB_PRIMARY_HOST || process.env.DB_HOST,
    });

    this.replicas = this.initializeReplicas();
    this.replicaHealth = new Map(); // Track replica health
    this.setupEventHandlers();
    this.startHealthChecks();
    this.testConnections();
  }

  createPool(name, config) {
    return new Pool({
      user: process.env.DB_USER,
      host: config.host,
      database: process.env.DB_NAME,
      password: String(process.env.DB_PASSWORD),
      port: process.env.DB_PORT || 5432,
      max: parseInt(process.env.DB_POOL_MAX) || 50,
      min: parseInt(process.env.DB_POOL_MIN) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      statement_timeout: 30000,
      // Enable prepared statement caching
      application_name: `chamasmart_${name}`,
    });
  }

  initializeReplicas() {
    const replicaHosts = process.env.DB_REPLICA_HOSTS
      ? process.env.DB_REPLICA_HOSTS.split(",")
      : [];

    return replicaHosts.map((host, index) => {
      const pool = this.createPool(`replica_${index + 1}`, {
        host: host.trim(),
      });

      // Initialize as healthy
      this.replicaHealth.set(pool, {
        healthy: true,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
      });

      logger.info(`Read replica ${index + 1} configured`, {
        host: host.trim(),
      });

      return pool;
    });
  }

  setupEventHandlers() {
    const setupPoolEvents = (pool, name) => {
      pool.on("connect", () => {
        if (metrics?.databasePoolSize) {
          metrics.databasePoolSize.set(
            { pool: name, state: "active" },
            pool.totalCount,
          );
        }
      });

      pool.on("acquire", () => {
        if (metrics?.databasePoolSize) {
          metrics.databasePoolSize.set(
            { pool: name, state: "idle" },
            pool.idleCount,
          );
        }
      });

      pool.on("error", (err) => {
        logger.error(`Unexpected error on ${name} pool`, {
          error: err.message,
          stack: err.stack,
        });

        // Mark replica as unhealthy
        if (name.startsWith("replica")) {
          const health = this.replicaHealth.get(pool);
          if (health) {
            health.healthy = false;
            health.consecutiveFailures++;
          }
        }
      });

      pool.on("remove", () => {
        if (metrics?.databasePoolSize) {
          metrics.databasePoolSize.set(
            { pool: name, state: "active" },
            pool.totalCount,
          );
        }
      });
    };

    setupPoolEvents(this.primary, "primary");
    this.replicas.forEach((replica, i) =>
      setupPoolEvents(replica, `replica_${i + 1}`),
    );
  }

  async testConnections() {
    // Test primary
    try {
      const client = await this.primary.connect();
      const result = await client.query(
        "SELECT NOW() as current_time, version()",
      );
      logger.info("Primary database connected", {
        host: process.env.DB_PRIMARY_HOST || process.env.DB_HOST,
        database: process.env.DB_NAME,
        version: result.rows[0].version.split(" ")[1],
        maxConnections: this.primary.options.max,
      });
      client.release();
    } catch (err) {
      logger.error("Primary database connection failed", {
        error: err.message,
        host: process.env.DB_PRIMARY_HOST || process.env.DB_HOST,
      });
      throw err; // Fatal error
    }

    // Test replicas (non-fatal)
    for (let i = 0; i < this.replicas.length; i++) {
      try {
        const client = await this.replicas[i].connect();
        await client.query("SELECT 1");
        logger.info(`Replica ${i + 1} connected successfully`);
        client.release();
      } catch (err) {
        logger.error(`Replica ${i + 1} connection failed`, {
          error: err.message,
        });
        this.replicaHealth.get(this.replicas[i]).healthy = false;
      }
    }
  }

  // Periodic health checks for replicas
  startHealthChecks() {
    const checkInterval =
      parseInt(process.env.DB_HEALTH_CHECK_INTERVAL) || 30000;

    setInterval(async () => {
      for (const [pool, health] of this.replicaHealth.entries()) {
        try {
          const client = await pool.connect();
          await client.query("SELECT 1");
          client.release();

          // Mark as healthy
          health.healthy = true;
          health.consecutiveFailures = 0;
          health.lastCheck = Date.now();
        } catch (err) {
          health.healthy = false;
          health.consecutiveFailures++;
          health.lastCheck = Date.now();

          logger.warn("Replica health check failed", {
            consecutiveFailures: health.consecutiveFailures,
            error: err.message,
          });
        }
      }
    }, checkInterval);
  }

  // Get healthy read pool with least connections strategy
  getReadPool() {
    if (this.replicas.length === 0) {
      return this.primary;
    }

    // Filter healthy replicas
    const healthyReplicas = this.replicas.filter(
      (pool) => this.replicaHealth.get(pool)?.healthy,
    );

    if (healthyReplicas.length === 0) {
      logger.warn("No healthy replicas available, falling back to primary");
      return this.primary;
    }

    // Least connections strategy
    return healthyReplicas.reduce((best, current) => {
      const bestActive = best.totalCount - best.idleCount;
      const currentActive = current.totalCount - current.idleCount;
      return currentActive < bestActive ? current : best;
    });
  }

  getWritePool() {
    return this.primary;
  }

  // Automatic query routing based on SQL command
  detectQueryType(sql) {
    const normalized = sql.trim().toUpperCase();
    const writePatterns =
      /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|REPLACE)/;
    const readPatterns = /^(SELECT|SHOW|DESCRIBE|EXPLAIN|WITH.*SELECT)/;

    if (writePatterns.test(normalized)) {
      return "write";
    }
    if (readPatterns.test(normalized)) {
      return "read";
    }

    // Default to write for safety
    logger.warn("Unable to detect query type, defaulting to write", {
      query: sql.substring(0, 50),
    });
    return "write";
  }

  async query(sql, params, options = {}) {
    const queryText = typeof sql === "string" ? sql : sql.text;

    // Auto-detect or use explicit routing
    const queryType =
      options.write !== undefined
        ? options.write
          ? "write"
          : "read"
        : this.detectQueryType(queryText);

    const pool =
      queryType === "write" ? this.getWritePool() : this.getReadPool();

    const start = Date.now();
    const operation = queryText.trim().split(" ")[0].toUpperCase();

    try {
      const result = await pool.query(sql, params);
      const duration = Date.now() - start;

      // Track metrics
      if (metrics?.databaseQueryDuration) {
        const table = this.extractTableName(queryText);
        metrics.databaseQueryDuration.observe(
          {
            query_type: operation,
            table,
            pool_type: queryType,
          },
          duration / 1000,
        );
      }

      // Adaptive slow query logging
      const slowThreshold = options.slowQueryThreshold || 1000;
      if (duration > slowThreshold) {
        logger.warn("Slow query detected", {
          query: queryText.substring(0, 300),
          duration: `${duration}ms`,
          rowCount: result.rowCount,
          operation,
          poolType: queryType,
          params: this.sanitizeParams(params),
        });
      } else if (duration > 100) {
        logger.debug("Query executed", {
          duration: `${duration}ms`,
          rowCount: result.rowCount,
          operation,
        });
      }

      return result;
    } catch (error) {
      // Track error metrics
      if (metrics?.databaseErrors) {
        metrics.databaseErrors.inc({
          error_type: error.code || "unknown",
        });
      }

      logger.error("Database query error", {
        query: queryText.substring(0, 300),
        error: error.message,
        code: error.code,
        operation,
        params: this.sanitizeParams(params),
      });

      throw error;
    }
  }

  // Transaction with automatic retry on serialization failures
  async transaction(callback, options = {}) {
    const maxRetries = options.maxRetries || 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      const client = await this.primary.connect();

      try {
        await client.query("BEGIN");

        // Set transaction isolation level if specified
        if (options.isolationLevel) {
          await client.query(
            `SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`,
          );
        }

        const result = await callback(client);
        await client.query("COMMIT");

        return result;
      } catch (error) {
        await client.query("ROLLBACK");

        // Retry on serialization failure
        if (error.code === "40001" && attempt < maxRetries - 1) {
          attempt++;
          logger.warn("Transaction serialization failure, retrying", {
            attempt,
            maxRetries,
          });

          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
          continue;
        }

        logger.error("Transaction error", {
          error: error.message,
          code: error.code,
          attempt: attempt + 1,
        });
        throw error;
      } finally {
        client.release();
      }
    }
  }

  // Batch insert optimization
  async batchInsert(table, columns, rows, options = {}) {
    if (!rows || rows.length === 0) {
      return { rowCount: 0 };
    }

    const batchSize = options.batchSize || 1000;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      // Generate value placeholders
      const valuePlaceholders = batch
        .map((_, rowIndex) => {
          const rowStart = rowIndex * columns.length;
          const placeholders = columns
            .map((_, colIndex) => `$${rowStart + colIndex + 1}`)
            .join(", ");
          return `(${placeholders})`;
        })
        .join(", ");

      const sql = `
                INSERT INTO ${table} (${columns.join(", ")})
                VALUES ${valuePlaceholders}
                ${options.onConflict || ""}
                ${options.returning ? "RETURNING " + options.returning : ""}
            `;

      const values = batch.flat();
      const result = await this.query(sql, values, { write: true });
      totalInserted += result.rowCount;
    }

    logger.info("Batch insert completed", {
      table,
      totalRows: rows.length,
      inserted: totalInserted,
    });

    return { rowCount: totalInserted };
  }

  extractTableName(query) {
    const patterns = [
      /(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
      /(?:TABLE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) return match[1].toLowerCase();
    }

    return "unknown";
  }

  sanitizeParams(params) {
    if (!params) return null;

    return params.map((p) => {
      if (typeof p === "string" && p.length > 100) {
        return p.substring(0, 100) + "...";
      }
      return p;
    });
  }

  // Get comprehensive pool statistics
  getPoolStats() {
    const stats = {
      primary: {
        total: this.primary.totalCount,
        idle: this.primary.idleCount,
        waiting: this.primary.waitingCount,
        max: this.primary.options.max,
      },
      replicas: this.replicas.map((replica, index) => ({
        index: index + 1,
        total: replica.totalCount,
        idle: replica.idleCount,
        waiting: replica.waitingCount,
        max: replica.options.max,
        healthy: this.replicaHealth.get(replica)?.healthy || false,
        lastCheck: this.replicaHealth.get(replica)?.lastCheck,
      })),
    };

    // Update Prometheus metrics
    if (metrics?.databasePoolSize) {
      metrics.databasePoolSize.set(
        { pool: "primary", state: "idle" },
        this.primary.idleCount,
      );
      metrics.databasePoolSize.set(
        { pool: "primary", state: "active" },
        this.primary.totalCount - this.primary.idleCount,
      );
      metrics.databasePoolSize.set(
        { pool: "primary", state: "waiting" },
        this.primary.waitingCount,
      );
    }

    return stats;
  }

  // Health check endpoint data
  async getHealthStatus() {
    const checks = [];

    // Check primary
    try {
      const client = await this.primary.connect();
      await client.query("SELECT 1");
      client.release();
      checks.push({ pool: "primary", healthy: true });
    } catch (err) {
      checks.push({
        pool: "primary",
        healthy: false,
        error: err.message,
      });
    }

    // Check replicas
    for (let i = 0; i < this.replicas.length; i++) {
      const health = this.replicaHealth.get(this.replicas[i]);
      checks.push({
        pool: `replica_${i + 1}`,
        healthy: health?.healthy || false,
        lastCheck: health?.lastCheck,
        consecutiveFailures: health?.consecutiveFailures,
      });
    }

    return {
      overall: checks.every((c) => c.healthy),
      checks,
      stats: this.getPoolStats(),
    };
  }

  // Graceful shutdown
  async end() {
    logger.info("Closing database connections...");

    await this.primary.end();
    logger.info("Primary pool closed");

    for (let i = 0; i < this.replicas.length; i++) {
      await this.replicas[i].end();
      logger.info(`Replica ${i + 1} pool closed`);
    }
  }
}

// Create singleton
const dbRouter = new DatabaseRouter();

// Export both router and primary pool for backward compatibility
module.exports = dbRouter;
module.exports.pool = dbRouter.primary;

// Graceful shutdown handlers
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing database connections");
  await dbRouter.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, closing database connections");
  await dbRouter.end();
  process.exit(0);
});
