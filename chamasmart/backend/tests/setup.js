// Test setup file
process.env.NODE_ENV = 'test';

// Use environment variables for secrets, with fallback to test-safe values
process.env.JWT_SECRET_V1 = process.env.JWT_SECRET_V1 || 'test-jwt-secret-v1-' + crypto.randomBytes(16).toString('hex');
process.env.JWT_SECRET_V2 = process.env.JWT_SECRET_V2 || 'test-jwt-secret-v2-' + crypto.randomBytes(16).toString('hex');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-' + crypto.randomBytes(16).toString('hex');
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || Buffer.alloc(32).toString('base64');

// Database test configuration
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_NAME = process.env.DB_NAME || 'chamasmart_test';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';
process.env.DB_PORT = process.env.DB_PORT || '5432';

// Other test config
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Metrics test token (for tests only)
process.env.METRICS_AUTH_TOKEN = process.env.METRICS_AUTH_TOKEN || 'test-metrics-token-' + crypto.randomBytes(16).toString('hex');

// Mock logger to reduce noise in tests
const crypto = require('crypto');
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
