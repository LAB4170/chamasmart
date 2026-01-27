#!/usr/bin/env node

/**
 * Metrics Dashboard Script
 * Provides real-time application metrics and monitoring
 */

const client = require('prom-client');
const { pool } = require('../config/db');
const redis = require('../config/redis');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for ChamaSmart
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new client.Gauge({
  name: 'database_active_connections',
  help: 'Number of active database connections',
});

const databaseQueryDuration = new client.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const cacheHitRate = new client.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
});

const cacheOperations = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'],
});

const activeUsers = new client.Gauge({
  name: 'active_users_total',
  help: 'Number of currently active users',
});

const totalChamas = new client.Gauge({
  name: 'total_chamas',
  help: 'Total number of chamas',
});

const totalContributions = new client.Gauge({
  name: 'total_contributions',
  help: 'Total number of contributions',
});

const totalLoans = new client.Gauge({
  name: 'total_loans',
  help: 'Total number of loans',
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(activeConnections);
register.registerMetric(databaseQueryDuration);
register.registerMetric(cacheHitRate);
register.registerMetric(cacheOperations);
register.registerMetric(activeUsers);
register.registerMetric(totalChamas);
register.registerMetric(totalContributions);
register.registerMetric(totalLoans);

// Middleware to track HTTP requests
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);

    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });

  next();
}

// Update database metrics
async function updateDatabaseMetrics() {
  try {
    // Update active connections
    activeConnections.set(pool.totalCount);

    // Update business metrics
    const [
      userCount,
      chamaCount,
      contributionCount,
      loanCount,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      pool.query('SELECT COUNT(*) as count FROM chamas WHERE is_active = true'),
      pool.query('SELECT COUNT(*) as count FROM contributions'),
      pool.query('SELECT COUNT(*) as count FROM loans'),
    ]);

    activeUsers.set(parseInt(userCount.rows[0].count));
    totalChamas.set(parseInt(chamaCount.rows[0].count));
    totalContributions.set(parseInt(contributionCount.rows[0].count));
    totalLoans.set(parseInt(loanCount.rows[0].count));
  } catch (error) {
    console.error('Error updating database metrics:', error.message);
  }
}

// Update cache metrics
async function updateCacheMetrics() {
  try {
    // Get Redis info
    const info = await redis.info('stats');
    const stats = {};

    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    });

    // Calculate hit rate
    const hits = parseInt(stats.keyspace_hits) || 0;
    const misses = parseInt(stats.keyspace_misses) || 0;
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    cacheHitRate.set(hitRate);
  } catch (error) {
    console.error('Error updating cache metrics:', error.message);
  }
}

// Metrics endpoint
async function getMetrics(req, res) {
  try {
    // Update metrics before serving
    await Promise.all([
      updateDatabaseMetrics(),
      updateCacheMetrics(),
    ]);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error serving metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
}

// Dashboard data
async function getDashboardData() {
  try {
    await Promise.all([
      updateDatabaseMetrics(),
      updateCacheMetrics(),
    ]);

    const metrics = await register.getMetricsAsJSON();

    return {
      timestamp: new Date().toISOString(),
      metrics: {
        http: {
          requests: metrics.find(m => m.name === 'http_requests_total')?.values || [],
          duration: metrics.find(m => m.name === 'http_request_duration_seconds')?.values || [],
        },
        database: {
          connections: metrics.find(m => m.name === 'database_active_connections')?.values?.[0]?.value || 0,
          queryDuration: metrics.find(m => m.name === 'database_query_duration_seconds')?.values || [],
        },
        cache: {
          hitRate: metrics.find(m => m.name === 'cache_hit_rate')?.values?.[0]?.value || 0,
          operations: metrics.find(m => m.name === 'cache_operations_total')?.values || [],
        },
        business: {
          activeUsers: metrics.find(m => m.name === 'active_users_total')?.values?.[0]?.value || 0,
          totalChamas: metrics.find(m => m.name === 'total_chamas')?.values?.[0]?.value || 0,
          totalContributions: metrics.find(m => m.name === 'total_contributions')?.values?.[0]?.value || 0,
          totalLoans: metrics.find(m => m.name === 'total_loans')?.values?.[0]?.value || 0,
        },
        system: {
          cpu: metrics.find(m => m.name === 'nodejs_cpu_usage_total')?.values || [],
          memory: metrics.find(m => m.name === 'nodejs_heap_size_used_bytes')?.values || [],
        },
      },
    };
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    return { error: 'Failed to get dashboard data' };
  }
}

// Start metrics collection
function startMetricsCollection(interval = 30000) {
  console.log(`📊 Starting metrics collection (interval: ${interval}ms)`);

  setInterval(async () => {
    try {
      await Promise.all([
        updateDatabaseMetrics(),
        updateCacheMetrics(),
      ]);
    } catch (error) {
      console.error('Error in metrics collection:', error.message);
    }
  }, interval);
}

// Display dashboard
async function displayDashboard() {
  try {
    const data = await getDashboardData();

    console.clear();
    console.log('📊 ChamaSmart Metrics Dashboard');
    console.log('='.repeat(50));
    console.log(`📅 ${data.timestamp}`);
    console.log('');

    // Business Metrics
    console.log('🏢 Business Metrics:');
    console.log(`   Active Users: ${data.metrics.business.activeUsers}`);
    console.log(`   Total Chamas: ${data.metrics.business.totalChamas}`);
    console.log(`   Total Contributions: ${data.metrics.business.totalContributions}`);
    console.log(`   Total Loans: ${data.metrics.business.totalLoans}`);
    console.log('');

    // System Metrics
    console.log('💻 System Metrics:');
    console.log(`   Database Connections: ${data.metrics.database.connections}`);
    console.log(`   Cache Hit Rate: ${data.metrics.cache.hitRate.toFixed(2)}%`);
    console.log('');

    // HTTP Metrics
    const totalRequests = data.metrics.http.requests.reduce((sum, req) => sum + parseInt(req.value), 0);
    console.log('🌐 HTTP Metrics:');
    console.log(`   Total Requests: ${totalRequests}`);
    console.log(`   Recent Requests: ${data.metrics.http.requests.slice(-5).map(r => `${r.labels.method} ${r.labels.route} (${r.labels.status_code})`).join(', ')}`);
    console.log('');

    console.log('Press Ctrl+C to exit. Dashboard updates every 30 seconds.');
  } catch (error) {
    console.error('Error displaying dashboard:', error);
  }
}

// Run dashboard if called directly
if (require.main === module) {
  startMetricsCollection();

  // Display dashboard immediately and then every 30 seconds
  displayDashboard();
  setInterval(displayDashboard, 30000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down metrics dashboard...');
    process.exit(0);
  });
}

module.exports = {
  metricsMiddleware,
  getMetrics,
  getDashboardData,
  startMetricsCollection,
  register,
};
