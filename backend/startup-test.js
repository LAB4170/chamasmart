#!/usr/bin/env node

/**
 * Startup Test Script
 * Tests critical components before starting the server
 */

const { testConnection } = require('./config/db');

console.log('🚀 ChamaSmart Startup Test');
console.log('=====================================\n');

async function runStartupTests() {
  const tests = [
    {
      name: 'Environment Variables',
      test: () => {
        const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'PORT'];
        const missing = required.filter(key => !process.env[key]);
        if (missing.length > 0) {
          throw new Error(
            `Missing environment variables: ${missing.join(', ')}`,
          );
        }
        return true;
      },
    },
    {
      name: 'Database Connection',
      test: async () => {
        const connected = await testConnection();
        if (!connected) {
          throw new Error('Database connection failed');
        }
        return true;
      },
    },
    {
      name: 'Port Availability',
      test: async () => {
        const port = process.env.PORT || 5005;
        const net = require('net');

        return new Promise((resolve, reject) => {
          const server = net.createServer();

          server.listen(port, () => {
            server.once('close', () => {
              resolve(true);
            });
            server.close();
          });

          server.on('error', err => {
            if (err.code === 'EADDRINUSE') {
              reject(new Error(`Port ${port} is already in use`));
            } else {
              reject(err);
            }
          });
        });
      },
    },
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      await test.test();
      console.log(`✅ ${test.name} - PASSED`);
    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Error: ${error.message}`);
      allPassed = false;
    }
  }

  console.log('\n=====================================');

  if (allPassed) {
    console.log('🎉 All startup tests passed!');
    console.log('Ready to start the server.\n');
    return true;
  }
  console.log('💥 Startup tests failed!');
  console.log('Please fix the issues above before starting the server.\n');
  return false;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runStartupTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error during startup test:', error);
      process.exit(1);
    });
}

module.exports = { runStartupTests };
