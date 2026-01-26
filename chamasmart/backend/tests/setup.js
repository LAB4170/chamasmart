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

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();

  // Add any other global test setup here
});

afterAll(async () => {
  // Cleanup after all tests
  jest.resetAllMocks();
});

// Global test utilities
global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
