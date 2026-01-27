// Test setup file
import { jest } from "@jest/globals";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  "test_jwt_secret_8113dd7319b6769718fa08b1f1c589cb8e230528cb32186ab6293a64fcf8137cfe964abb869a0fa999f62fa621afdf80f824dd31445cff3cf7f93916ecc2db493";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/chamasmart_test";

// Mock database connection
jest.mock("../config/db.js", () => ({
  query: jest.fn(() => Promise.resolve({ rows: [] })),
  connect: jest.fn(() => Promise.resolve()),
  end: jest.fn(() => Promise.resolve()),
}));

// Mock external services
jest.mock("../utils/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../utils/smsService", () => ({
  sendSMS: jest.fn().mockResolvedValue({ success: true }),
  sendOTP: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../config/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
}));

// Mock file upload
jest.mock("multer", () => ({
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
}));

// Mock notification service
jest.mock("../utils/notifications", () => ({
  sendNotification: jest.fn().mockResolvedValue({ success: true }),
  sendBulkNotification: jest.fn().mockResolvedValue({ success: true }),
  sendChamaNotification: jest.fn().mockResolvedValue({ success: true }),
  sendOfficialNotification: jest.fn().mockResolvedValue({ success: true }),
}));

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Mock console methods to reduce test noise
  global.console = {
    ...global.console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(async () => {
  // Cleanup after all tests
  jest.resetAllMocks();
});

// Global test utilities
global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
global.testUtils = {
  // Create test user helper
  createTestUser: async (userData = {}) => {
    const defaultUser = {
      first_name: "Test",
      last_name: "User",
      email: `test${Math.random().toString(36).substring(7)}@example.com`,
      password: "SecurePass123!",
      phone_number: "+254712345678",
      ...userData,
    };
    return defaultUser;
  },

  // Create test chama helper
  createTestChama: (chamaData = {}) => {
    const defaultChama = {
      chama_name: "Test Chama",
      chama_type: "CHAMA",
      contribution_amount: 5000.0,
      contribution_frequency: "MONTHLY",
      ...chamaData,
    };
    return defaultChama;
  },

  // Generate random test data
  randomEmail: () =>
    `test${Math.random().toString(36).substring(7)}@example.com`,
  randomPhoneNumber: () => `+2547${Math.random().toString(36).substring(7)}`,
  randomString: (length = 10) =>
    Math.random()
      .toString(36)
      .substring(2, length + 2),
};
