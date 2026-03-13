// Test setup file
// Note: jest is globally available in Jest environment

// Set test environment variables - Must be at least 32 chars for KeyManager
process.env.JWT_SECRET = 'test-secret-32-chars-long-for-jwt-security';
process.env.JWT_SECRET_V1 = 'test-secret-32-chars-long-for-jwt-security';
process.env.JWT_KEY_VERSION = '1';
process.env.JWT_EXPIRE = '1h';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-long';
process.env.REQUIRE_VERIFIED_EMAIL = 'false';

// CRITICAL: Mock key-management BEFORE any module loads to bypass singleton timing issue.
// The real KeyManager reads from .env at construction time (before our env overrides).
// jest.mock is hoisted by Jest before imports, guaranteeing both signing and verifying use the same key.
jest.mock('../security/modules/key-management', () => {
  const secret = 'test-secret-32-chars-long-for-jwt-security';
  const mockKeyManager = {
    getActiveKey: () => secret,
    getActiveKeyVersion: () => 1,
    getKeyForVerification: () => secret,
    keys: { 1: secret },
    activeKeyVersion: 1,
    validateKeys: () => [],
    getTokenSigningParams: () => ({ key: secret, algorithm: 'HS256', keyid: '1' }),
    isKeyInRotation: () => false,
  };
  return {
    getKeyManager: () => mockKeyManager,
    resetKeyManager: () => mockKeyManager,
    JWTKeyManager: jest.fn(() => mockKeyManager),
  };
});

// Also mock the legacy keyManagement path (used by tokenManager.js)
jest.mock('../security/keyManagement', () => {
  const secret = 'test-secret-32-chars-long-for-jwt-security';
  const mockKeyManager = {
    getActiveKey: () => secret,
    getActiveKeyVersion: () => 1,
    getKeyForVerification: () => secret,
    keys: { 1: secret },
    activeKeyVersion: 1,
    validateKeys: () => [],
    getTokenSigningParams: () => ({ key: secret, algorithm: 'HS256', keyid: '1' }),
    isKeyInRotation: () => false,
  };
  return {
    getKeyManager: () => mockKeyManager,
    resetKeyManager: () => mockKeyManager,
    JWTKeyManager: jest.fn(() => mockKeyManager),
  };
}, { virtual: true });

// Mock Firebase Admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  })),
}));

// Mock bcrypt for faster tests
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn((plain, hash) => Promise.resolve(plain !== 'wrongpassword')),
}));


// Stateful Database Mock
const usersStore = [];
const refreshTokensStore = [];
const chamasStore = []; // Added for the new count mock
let userIdCounter = 1;

const handleQuery = (text, params) => {
  if (!text) return Promise.resolve({ rows: [] });
  const query = text.trim().toLowerCase();
  console.debug(`[SQL Mock Query]: ${query}`);

  // Handle COUNT for chamas
  if (query.includes('count(*)') && query.includes('from chamas')) {
    return Promise.resolve({ rows: [{ count: chamasStore.length.toString() }], rowCount: 1 });
  }

  // Handle DELETE (cleanup)
  if (query.startsWith("delete from users")) {
    const initialLength = usersStore.length;
    if (typeof params[0] === 'string') {
      const emailPattern = params[0].replace(/%/g, "");
      for (let i = usersStore.length - 1; i >= 0; i--) {
        if (usersStore[i].email.includes(emailPattern)) {
          usersStore.splice(i, 1);
        }
      }
    } else {
      const index = usersStore.findIndex(u => u.user_id === params[0] || u.user_id === parseInt(params[0]));
      if (index !== -1) usersStore.splice(index, 1);
    }
    return Promise.resolve({ rowCount: initialLength - usersStore.length });
  }

  // Handle SELECT user by email/phone or just email
  if (query.match(/select .* from users where email = \$1/)) {
    const email = params[0];
    const phone = params[1]; // might be undefined
    const existingUser = usersStore.find(u => u.email === email || (phone && u.phone_number === phone));
    return Promise.resolve({ rows: existingUser ? [existingUser] : [] });
  }

  // Handle SELECT user by ID
  if (query.match(/select .* from users where user_id = \$1/)) {
    const [userId] = params;
    const existingUser = usersStore.find(u => u.user_id === parseInt(userId));
    return Promise.resolve({ rows: existingUser ? [existingUser] : [] });
  }

  // Handle INSERT users
  if (query.match(/insert into users/)) {
    const [email, password_hash, first_name, last_name, phone_number] = params;
    const newUser = {
      user_id: userIdCounter++,
      email,
      password_hash,
      first_name,
      last_name,
      phone_number,
      is_active: true,   // Required for auth.js protect middleware
      created_at: new Date()
    };
    usersStore.push(newUser);
    return Promise.resolve({ rows: [newUser] });
  }

  // Handle UPDATE users (last login etc)
  if (query.match(/update users set last_login_at/)) {
    return Promise.resolve({ rowCount: 1 });
  }

  // Handle INSERT refresh_tokens
  if (query.match(/insert into refresh_tokens/)) {
    const [user_id, token] = params;
    refreshTokensStore.push({ user_id, token, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    return Promise.resolve({ rowCount: 1 });
  }

  // Handle UPDATE refresh_tokens
  if (query.match(/update refresh_tokens/)) {
    const [newToken, oldToken] = params;
    const token = refreshTokensStore.find(t => t.token === oldToken);
    if (token) token.token = newToken;
    return Promise.resolve({ rowCount: token ? 1 : 0 });
  }

  // Handle DELETE FROM refresh_tokens
  if (query.match(/delete from refresh_tokens/)) {
    const [tokenVal] = params;
    const index = refreshTokensStore.findIndex(t => t.token === tokenVal);
    if (index !== -1) refreshTokensStore.splice(index, 1);
    return Promise.resolve({ rowCount: index !== -1 ? 1 : 0 });
  }

  // Handle INSERT chamas
  if (query.match(/insert into chamas/i)) {
    const [chama_name, chama_type, description, contribution_amount, contribution_frequency, meeting_day, meeting_time, created_by, visibility] = params;
    const newChama = {
      chama_id: chamasStore.length + 1,
      chama_name,
      chama_type,
      description,
      contribution_amount: parseFloat(contribution_amount),
      contribution_frequency,
      meeting_day,
      meeting_time,
      created_by,
      visibility,
      is_active: true,
      total_members: 1,
      created_at: new Date()
    };
    chamasStore.push(newChama);
    return Promise.resolve({ rows: [newChama] });
  }

  // Handle SELECT chamas (all or by ID) - supports multi-line
  if (query.match(/select[\s\S]*from chamas/i)) {
    if (query.includes('chama_id = $1') || query.includes('c.chama_id = $1')) {
      const chama = chamasStore.find(c => c.chama_id === parseInt(params[0]));
      return Promise.resolve({ rows: chama ? [chama] : [] });
    }
    // Search search functionality
    if (query.includes('chama_name ilike')) {
      const search = params[0].replace(/%/g, '').toLowerCase();
      const results = chamasStore.filter(c => c.chama_name.toLowerCase().includes(search) || (c.description && c.description.toLowerCase().includes(search)));
      return Promise.resolve({ rows: results });
    }
    return Promise.resolve({ rows: chamasStore });
  }

  // Handle UPDATE chamas
  if (query.match(/update chamas[\s\S]*where[\s\S]*chama_id = \$/i)) {
    return Promise.resolve({ rows: [chamasStore[0]], rowCount: 1 }); // Mock simple update success
  }

  // Handle DELETE (soft) chamas
  if (query.includes('update chamas set is_active = false') || query.includes('deleted_at = now()')) {
    return Promise.resolve({ rowCount: 1 });
  }

  // Handle chama_members checks
  if (query.includes('from chama_members')) {
    return Promise.resolve({ rows: [{ role: 'CHAIRPERSON', count: '1' }] });
  }

  // Handle Transactions
  if (query === "begin" || query === "commit" || query === "rollback") {
    return Promise.resolve({ rowCount: 0 });
  }

  // Default empty response
  return Promise.resolve({ rows: [] });
};


jest.mock("../config/db", () => {
  const mockClient = {
    query: jest.fn((text, params) => handleQuery(text, params)),
    release: jest.fn(),
  };
  const mockPool = {
    query: jest.fn((text, params) => handleQuery(text, params)),
    connect: jest.fn(() => Promise.resolve(mockClient)),
    end: jest.fn(() => Promise.resolve()),
  };
  return {
    ...mockPool,
    pool: mockPool,
    testConnection: jest.fn().mockResolvedValue(true),
  };
});

// Stateful Redis Mock
const mockRedisStore = new Map();

jest.mock("../config/redis", () => ({
  redis: {
    get: jest.fn((key) => Promise.resolve(mockRedisStore.get(key) || null)),
    set: jest.fn((key, value) => {
      mockRedisStore.set(key, value);
      return Promise.resolve("OK");
    }),
    setex: jest.fn((key, seconds, value) => {
      mockRedisStore.set(key, value);
      return Promise.resolve("OK");
    }),
    del: jest.fn((key) => {
      const deleted = mockRedisStore.delete(key);
      return Promise.resolve(deleted ? 1 : 0);
    }),
    exists: jest.fn((key) => Promise.resolve(mockRedisStore.has(key) ? 1 : 0)),
    expire: jest.fn(() => Promise.resolve(1)),
    incr: jest.fn((key) => {
      const val = parseInt(mockRedisStore.get(key) || "0") + 1;
      mockRedisStore.set(key, val.toString());
      return Promise.resolve(val);
    }),
    ttl: jest.fn().mockResolvedValue(3600),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK"),
  },
  testRedisConnection: jest.fn().mockResolvedValue(true),
  initializeRedis: jest.fn().mockResolvedValue(true),
}));

// Mock Audit Log
jest.mock("../utils/auditLog", () => ({
  logAuditEvent: jest.fn().mockResolvedValue({ success: true }),
  logAudit: jest.fn().mockResolvedValue({ success: true }),
  auditMiddleware: (req, res, next) => next(),
  auditMiddlewareEnhanced: (req, res, next) => next(),
  EVENT_TYPES: {
    AUTH_LOGIN: 'auth_login',
    AUTH_LOGOUT: 'auth_logout',
    AUTH_REGISTER: 'auth_register',
    AUTH_PASSWORD_RESET: 'auth_password_reset',
    AUTH_FAILED_LOGIN: 'auth_failed_login',
    AUTH_ACCOUNT_LOCKED: 'auth_account_locked',
    AUTH_REGISTER_ATTEMPT: 'auth_register_attempt',
    AUTH_LOGIN_ATTEMPT: 'auth_login_attempt'
  },
  SEVERITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
  sanitizeMetadata: (m) => m,
}));

// Ensure KeyManager is initialized with the test secrets (already done above)

// Mock Logger - actually log for debugging
jest.mock("../utils/logger", () => ({
  info: (msg, meta) => console.log(`[LOGGER INFO] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[LOGGER ERROR] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[LOGGER WARN] ${msg}`, meta || ''),
  debug: (msg, meta) => console.log(`[LOGGER DEBUG] ${msg}`, meta || ''),
  logAudit: jest.fn(),
  logSecurityEvent: (msg, meta) => console.log(`[SEC EVENT] ${msg}`, meta || ''),
  logError: (err, meta) => console.error(`[LOGGER ERR] ${err.message}`, meta || ''),
  logWarning: (msg, meta) => console.warn(`[LOGGER WARN] ${msg}`, meta || ''),
  logInfo: (msg, meta) => console.log(`[LOGGER INFO] ${msg}`, meta || ''),
  requestId: (req, res, next) => {
    req.id = 'test-request-id';
    next();
  },
}));

// Mock Enhanced Request Logger
jest.mock("../middleware/enhancedRequestLogger", () => ({
  requestLogger: (req, res, next) => next(),
  detailedRequestLogger: (req, res, next) => next(),
}));

// Mock Enhanced Rate Limiting globally to prevent Redis evaluation errors
jest.mock("../security/enhancedRateLimiting", () => ({
  apiLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  paymentLimiter: (req, res, next) => next(),
  checkLoginRateLimit: jest.fn().mockResolvedValue(false),
  checkOtpRateLimit: jest.fn().mockResolvedValue(false),
  checkPasswordResetRateLimit: jest.fn().mockResolvedValue(false),
}));

// Mock external services
jest.mock("../utils/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock file upload
const mockMulter = jest.fn(() => ({
  single: jest.fn(() => (req, res, next) => {
    req.file = {
      fieldname: "file",
      originalname: "test.jpg",
      mimetype: "image/jpeg",
      size: 1024,
      buffer: Buffer.from("test file content"),
    };
    next();
  }),
  array: jest.fn(() => (req, res, next) => {
    req.files = [{
      fieldname: "file",
      originalname: "test.jpg",
      mimetype: "image/jpeg",
      size: 1024,
      buffer: Buffer.from("test file content"),
    }];
    next();
  }),
  fields: jest.fn(() => (req, res, next) => next()),
  none: jest.fn(() => (req, res, next) => next()),
  any: jest.fn(() => (req, res, next) => next()),
}));

mockMulter.memoryStorage = jest.fn(() => ({}));
mockMulter.diskStorage = jest.fn(() => ({}));
mockMulter.MulterError = class MulterError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};

jest.mock("multer", () => mockMulter);

// Mock notification service
jest.mock("../utils/notifications", () => ({
  sendNotification: jest.fn().mockResolvedValue({ success: true }),
  sendBulkNotification: jest.fn().mockResolvedValue({ success: true }),
  sendChamaNotification: jest.fn().mockResolvedValue({ success: true }),
  sendOfficialNotification: jest.fn().mockResolvedValue({ success: true }),
}));

// Global test setup
beforeAll(() => {
  jest.clearAllMocks();
  usersStore.length = 0;
  chamasStore.length = 0;
  mockRedisStore.clear();
  userIdCounter = 1;
});

afterAll(async () => {
  jest.resetAllMocks();
});

// Global test utilities
global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
global.testUtils = {
  createTestUser: async (userData = {}) => {
    return {
      user_id: 1,
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      ...userData,
    };
  },
  createTestChama: (chamaData = {}) => {
    return {
      chama_id: 1,
      chama_name: "Test Chama",
      ...chamaData,
    };
  },
  randomEmail: () => `test${Math.random().toString(36).substring(7)}@example.com`,
  randomPhoneNumber: () => `+2547${Math.random().toString(36).substring(7)}`,
  randomString: (length = 10) => Math.random().toString(36).substring(2, length + 2),
};

