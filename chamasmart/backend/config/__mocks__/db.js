/**
 * Comprehensive database mock for testing
 *
 * Features:
 * - In-memory data structures
 * - Query pattern matching
 * - Error simulation
 * - Relationship enforcement
 * - Transaction support
 * - Extensible query handlers
 */

console.log('[MOCK] Loading comprehensive mocked database');

// In-memory database
const testDB = {
  users: {},
  chamas: {},
  joinRequests: {},
  loans: {},
  proposals: {},
  roscaCycles: {},
  ascaGroups: {},
  notifications: {},
  chamaMembers: {},
  transactions: {},
};

// Auto-increment counters
const counters = {
  user: 1000,
  chama: 2000,
  loan: 3000,
  transaction: 4000,
};

// Error simulation control
let simulateError = null;
let errorCount = 0;

// Track query statistics
const queryStats = {
  total: 0,
  selects: 0,
  inserts: 0,
  updates: 0,
  deletes: 0,
  transactions: 0,
};

/**
 * Query pattern handlers
 */
const queryHandlers = {
  // User queries
  'SELECT * FROM users WHERE email = $1': values => {
    const email = values[0]?.toLowerCase();
    const user = Object.values(testDB.users).find(u => u.email === email);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  },

  'SELECT * FROM users WHERE email = $1 OR phone_number = $2': values => {
    const email = values[0]?.toLowerCase();
    const phone = values[1];
    const user = Object.values(testDB.users).find(
      u => u.email === email || u.phone_number === phone,
    );
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  },

  'SELECT * FROM users WHERE user_id = $1': values => {
    const userId = values[0];
    const user = testDB.users[userId];
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  },

  'INSERT INTO users': (values, fullQuery) => {
    const userId = counters.user++;
    const user = {
      user_id: userId,
      email: values[0]?.toLowerCase(),
      password_hash: values[1],
      first_name: values[2],
      last_name: values[3],
      phone_number: values[4],
      national_id: values[5],
      created_at: new Date(),
      updated_at: new Date(),
      email_verification_token: null,
      email_verified: false,
      phone_verified: false,
      phone_verification_code: null,
      email_verification_last_sent_at: null,
      phone_verification_last_sent_at: null,
    };

    testDB.users[userId] = user;

    // Check for RETURNING clause
    if (fullQuery.includes('RETURNING')) {
      return {
        rows: [user],
        rowCount: 1,
      };
    }

    return {
      rows: [
        {
          user_id: user.user_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          created_at: user.created_at,
        },
      ],
      rowCount: 1,
    };
  },

  'UPDATE users': (values, fullQuery) => {
    // Determine what's being updated
    if (fullQuery.includes('email_verification_token')) {
      const userId = values[values.length - 1];
      if (testDB.users[userId]) {
        testDB.users[userId].email_verification_token = values[0];
        testDB.users[userId].email_verification_expires_at = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        );
        testDB.users[userId].email_verification_last_sent_at = new Date();
        testDB.users[userId].updated_at = new Date();
      }
      return { rowCount: testDB.users[userId] ? 1 : 0 };
    }

    if (fullQuery.includes('phone_verification_code')) {
      const userId = values[values.length - 1];
      if (testDB.users[userId]) {
        testDB.users[userId].phone_verification_code = values[0];
        testDB.users[userId].phone_verification_expires_at = new Date(
          Date.now() + 10 * 60 * 1000,
        );
        testDB.users[userId].phone_verification_attempts = 0;
        testDB.users[userId].phone_verification_last_sent_at = new Date();
        testDB.users[userId].updated_at = new Date();
      }
      return { rowCount: testDB.users[userId] ? 1 : 0 };
    }

    if (fullQuery.includes('email_verified')) {
      const userId = values[values.length - 1];
      if (testDB.users[userId]) {
        testDB.users[userId].email_verified = true;
        testDB.users[userId].email_verification_token = null;
        testDB.users[userId].updated_at = new Date();
      }
      return { rowCount: testDB.users[userId] ? 1 : 0 };
    }

    // Generic update
    const userId = values[values.length - 1];
    if (testDB.users[userId]) {
      testDB.users[userId].updated_at = new Date();
      return { rowCount: 1 };
    }
    return { rowCount: 0 };
  },

  'DELETE FROM users WHERE user_id = $1': values => {
    const userId = values[0];
    if (testDB.users[userId]) {
      delete testDB.users[userId];
      return { rowCount: 1 };
    }
    return { rowCount: 0 };
  },

  // Chama queries
  'INSERT INTO chamas': values => {
    const chamaId = counters.chama++;
    const chama = {
      chama_id: chamaId,
      name: values[0],
      description: values[1],
      created_by: values[2],
      created_at: new Date(),
      updated_at: new Date(),
    };
    testDB.chamas[chamaId] = chama;
    return { rows: [chama], rowCount: 1 };
  },

  'SELECT * FROM chamas WHERE chama_id = $1': values => {
    const chamaId = values[0];
    const chama = testDB.chamas[chamaId];
    return { rows: chama ? [chama] : [], rowCount: chama ? 1 : 0 };
  },

  // Transaction support
  BEGIN: () => {
    queryStats.transactions++;
    return { rowCount: 0 };
  },

  COMMIT: () => ({ rowCount: 0 }),

  ROLLBACK: () => ({ rowCount: 0 }),
};

/**
 * Match query to handler
 */
const matchQuery = queryText => {
  const normalized = queryText.trim();

  // Exact match first
  for (const [pattern, handler] of Object.entries(queryHandlers)) {
    if (normalized.startsWith(pattern)) {
      return handler;
    }
  }

  // Partial match for complex queries
  if (normalized.startsWith('SELECT')) {
    if (normalized.includes('FROM users')) {
      return queryHandlers['SELECT * FROM users WHERE user_id = $1'];
    }
    if (normalized.includes('FROM chamas')) {
      return queryHandlers['SELECT * FROM chamas WHERE chama_id = $1'];
    }
  }

  if (normalized.startsWith('INSERT INTO')) {
    if (normalized.includes('INTO users')) {
      return queryHandlers['INSERT INTO users'];
    }
    if (normalized.includes('INTO chamas')) {
      return queryHandlers['INSERT INTO chamas'];
    }
  }

  if (normalized.startsWith('UPDATE')) {
    if (normalized.includes('UPDATE users')) {
      return queryHandlers['UPDATE users'];
    }
  }

  return null;
};

/**
 * Main query mock
 */
const mockQuery = jest.fn(async (text, values = []) => {
  queryStats.total++;

  const queryText = typeof text === 'string' ? text : text.text;
  const queryValues = values || [];

  console.log('[MOCK_DB] Query:', queryText.substring(0, 100));
  console.log('[MOCK_DB] Values:', queryValues);

  // Error simulation
  if (simulateError) {
    errorCount++;
    if (errorCount >= simulateError.afterCalls) {
      const error = new Error(simulateError.message);
      error.code = simulateError.code;
      simulateError = null; // Reset
      throw error;
    }
  }

  try {
    // Track query types
    if (queryText.trim().startsWith('SELECT')) queryStats.selects++;
    if (queryText.trim().startsWith('INSERT')) queryStats.inserts++;
    if (queryText.trim().startsWith('UPDATE')) queryStats.updates++;
    if (queryText.trim().startsWith('DELETE')) queryStats.deletes++;

    // Find and execute handler
    const handler = matchQuery(queryText);
    if (handler) {
      const result = handler(queryValues, queryText);
      console.log('[MOCK_DB] Result:', result);
      return result;
    }

    // Default: return empty result
    console.log('[MOCK_DB] No handler found, returning empty result');
    return { rows: [], rowCount: 0 };
  } catch (err) {
    console.error('[MOCK_DB] Error:', err.message, err.stack);
    throw err;
  }
});

/**
 * Mock client for transactions
 */
const mockClientQuery = jest.fn(async (text, values) => mockQuery(text, values));

const mockConnect = jest.fn(async () => ({
  query: mockClientQuery,
  release: jest.fn(),
}));

/**
 * Test utilities
 */
const testUtils = {
  // Clear all data
  clearAll: () => {
    Object.keys(testDB).forEach(table => {
      testDB[table] = {};
    });
    console.log('[MOCK_DB] All tables cleared');
  },

  // Clear specific table
  clearTable: tableName => {
    if (testDB[tableName]) {
      testDB[tableName] = {};
      console.log(`[MOCK_DB] Table ${tableName} cleared`);
    }
  },

  // Get table data
  getTable: tableName => testDB[tableName] || {},

  // Seed data
  seedData: (tableName, data) => {
    if (testDB[tableName]) {
      testDB[tableName] = { ...testDB[tableName], ...data };
      console.log(
        `[MOCK_DB] Seeded ${Object.keys(data).length} rows to ${tableName}`,
      );
    }
  },

  // Simulate error
  simulateError: errorConfig => {
    simulateError = {
      message: errorConfig.message || 'Simulated database error',
      code: errorConfig.code || '23505', // Unique violation
      afterCalls: errorConfig.afterCalls || 1,
    };
    errorCount = 0;
    console.log('[MOCK_DB] Error simulation configured:', simulateError);
  },

  // Get query statistics
  getStats: () => ({ ...queryStats }),

  // Reset query statistics
  resetStats: () => {
    Object.keys(queryStats).forEach(key => {
      queryStats[key] = 0;
    });
    console.log('[MOCK_DB] Query stats reset');
  },

  // Add custom query handler
  addHandler: (pattern, handler) => {
    queryHandlers[pattern] = handler;
    console.log(`[MOCK_DB] Added custom handler for: ${pattern}`);
  },

  // Verify foreign key relationship
  verifyForeignKey: (childTable, childId, parentTable, parentId) => {
    const parent = testDB[parentTable][parentId];
    if (!parent) {
      throw new Error(
        `Foreign key violation: ${parentTable}(${parentId}) does not exist`,
      );
    }
  },
};

/**
 * Reset function for beforeEach
 */
const resetMock = () => {
  mockQuery.mockClear();
  mockClientQuery.mockClear();
  mockConnect.mockClear();
  testUtils.clearAll();
  testUtils.resetStats();
  simulateError = null;
  errorCount = 0;
};

module.exports = {
  query: mockQuery,
  connect: mockConnect,
  end: jest.fn(),
  on: jest.fn(),

  // Test utilities
  __mockQuery: mockQuery,
  __mockClientQuery: mockClientQuery,
  __testUtils: testUtils,
  __resetMock: resetMock,
  __getDB: () => testDB,
};
