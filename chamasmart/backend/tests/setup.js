// Test setup file
// Note: jest is globally available in Jest environment

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test_jwt_secret_8113dd7319b6769718fa08b1f1c589cb8e230528cb32186ab6293a64fcf8137cfe964abb869a0fa999f62fa621afdf80f824dd31445cff3cf7f93916ecc2db493";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/chamasmart_test";
process.env.FIREBASE_PROJECT_ID = "test-project";
process.env.FIREBASE_CLIENT_EMAIL = "test@example.com";
process.env.FIREBASE_PRIVATE_KEY = "test-private-key";
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.REQUIRE_VERIFIED_EMAIL = 'false';

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
let userIdCounter = 1;

const handleQuery = (text, params) => {
  const query = text.trim().toLowerCase();

  // Handle DELETE (cleanup)
  if (query.startsWith("delete from users")) {
    const emailPattern = params[0].replace(/%/g, "");
    const initialLength = usersStore.length;
    for (let i = usersStore.length - 1; i >= 0; i--) {
      if (usersStore[i].email.includes(emailPattern)) {
        usersStore.splice(i, 1);
      }
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
const redisStore = new Map();

jest.mock("../config/redis", () => ({
  redis: {
    get: jest.fn((key) => Promise.resolve(redisStore.get(key) || null)),
    set: jest.fn((key, value) => {
      redisStore.set(key, value);
      return Promise.resolve("OK");
    }),
    setex: jest.fn((key, seconds, value) => {
      redisStore.set(key, value);
      return Promise.resolve("OK");
    }),
    del: jest.fn((key) => {
      const deleted = redisStore.delete(key);
      return Promise.resolve(deleted ? 1 : 0);
    }),
    exists: jest.fn((key) => Promise.resolve(redisStore.has(key) ? 1 : 0)),
    expire: jest.fn(() => Promise.resolve(1)),
    incr: jest.fn((key) => {
      const val = parseInt(redisStore.get(key) || "0") + 1;
      redisStore.set(key, val.toString());
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

// Mock Logger
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logAudit: jest.fn(),
  logSecurityEvent: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  logInfo: jest.fn(),
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
beforeEach(() => {
  jest.clearAllMocks();
  usersStore.length = 0;
  redisStore.clear();
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

