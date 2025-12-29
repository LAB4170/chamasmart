// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'chamasmart_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'test';
process.env.DB_PORT = '5432';

// Mock logger to reduce noise in tests
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    logRequest: jest.fn(),
    logError: jest.fn(),
    logDatabaseQuery: jest.fn(),
    logSecurityEvent: jest.fn(),
}));

// Global test timeout
jest.setTimeout(10000);
