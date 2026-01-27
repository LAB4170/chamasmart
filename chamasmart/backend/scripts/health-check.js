#!/usr/bin/env node

/**
 * Health Check Script
 * Monitors the health of all system components
 */

const http = require('http');
const { pool } = require('../config/db');
const redis = require('../config/redis');

const HEALTH_CHECKS = {
  server: {
    name: 'API Server',
    check: async () => new Promise(resolve => {
      const options = {
        hostname: 'localhost',
        port: process.env.PORT || 5005,
        path: '/api/ping',
        method: 'GET',
        timeout: 5000,
      };

      const req = http.request(options, res => {
        resolve({
          status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          statusCode: res.statusCode,
        });
      });

      req.on('error', () => {
        resolve({ status: 'unhealthy', error: 'Connection failed' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'unhealthy', error: 'Timeout' });
      });

      const startTime = Date.now();
      req.end();
    }),
  },

  database: {
    name: 'PostgreSQL Database',
    check: async () => {
      try {
        const startTime = Date.now();
        const result = await pool.query('SELECT 1 as health_check');
        const responseTime = Date.now() - startTime;

        return {
          status: 'healthy',
          responseTime,
          connections: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
        };
      }
    },
  },

  redis: {
    name: 'Redis Cache',
    check: async () => {
      try {
        const startTime = Date.now();
        await redis.set('health_check', 'ok', 'EX', 10);
        const result = await redis.get('health_check');
        const responseTime = Date.now() - startTime;

        return {
          status: result === 'ok' ? 'healthy' : 'unhealthy',
          responseTime,
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
        };
      }
    },
  },

  memory: {
    name: 'Memory Usage',
    check: async () => {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();

      return {
        status: 'healthy', // Memory is always "healthy" unless critical
        memory: {
          used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
          system: {
            total: `${Math.round(totalMem / 1024 / 1024)}MB`,
            free: `${Math.round(freeMem / 1024 / 1024)}MB`,
            used: `${Math.round((totalMem - freeMem) / 1024 / 1024)}MB`,
          },
        },
      };
    },
  },

  disk: {
    name: 'Disk Usage',
    check: async () => {
      try {
        const fs = require('fs').promises;
        const stats = await fs.stat('.');

        return {
          status: 'healthy',
          disk: {
            available: 'N/A', // Would need additional library for detailed disk stats
          },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
        };
      }
    },
  },
};

async function runHealthChecks() {
  console.log('🔍 Running System Health Checks...\n');

  const results = {};
  let overallStatus = 'healthy';

  for (const [key, check] of Object.entries(HEALTH_CHECKS)) {
    try {
      const result = await check.check();
      results[key] = {
        name: check.name,
        ...result,
      };

      if (result.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      }

      // Display result
      const status = result.status === 'healthy' ? '✅' : '❌';
      const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
      const error = result.error ? ` - ${result.error}` : '';

      console.log(`${status} ${check.name}${responseTime}${error}`);

      // Display additional info
      if (result.connections) {
        console.log(`   Connections: ${result.connections.total} total, ${result.connections.idle} idle, ${result.connections.waiting} waiting`);
      }
      if (result.memory) {
        console.log(`   Memory: ${result.memory.used} used / ${result.memory.total} total`);
      }
    } catch (error) {
      results[key] = {
        name: check.name,
        status: 'unhealthy',
        error: error.message,
      };
      overallStatus = 'unhealthy';
      console.log(`❌ ${check.name} - ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);

  if (overallStatus === 'healthy') {
    console.log('🎉 All systems operational!');
    process.exit(0);
  } else {
    console.log('⚠️  Some systems require attention!');
    process.exit(1);
  }
}

// Run health checks if called directly
if (require.main === module) {
  runHealthChecks().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
  });
}

module.exports = { runHealthChecks, HEALTH_CHECKS };
