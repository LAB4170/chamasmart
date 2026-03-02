const request = require('supertest');
const { pool } = require('../config/db');

// Mock Auth and Rate Limiting BEFORE requiring app
jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { user_id: 1, email: 'test@example.com', role: 'MEMBER' };
    next();
  },
  authorize: () => (req, res, next) => next(),
  isOfficial: (req, res, next) => next(),
  isTreasurer: (req, res, next) => next(),
}));

jest.mock('../middleware/rateLimiting', () => ({
  applyAuthRateLimiting: (req, res, next) => next(),
  applyRateLimiting: (req, res, next) => next(),
  applyFinancialRateLimiting: (req, res, next) => next(),
}));

// Mock Enhanced Rate Limiting
jest.mock('../security/enhancedRateLimiting', () => ({
  checkLoginRateLimit: jest.fn().mockResolvedValue(false),
  checkOtpRateLimit: jest.fn().mockResolvedValue(false),
  checkPasswordResetRateLimit: jest.fn().mockResolvedValue(false),
  createRedisStore: jest.fn(),
}));

// Mock Redis configuration to avoid initialization errors
jest.mock('../config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
  }
}));

const app = require('../server');

describe('Authentication Consolidation Verification', () => {
  let server;
  let api;

  beforeAll((done) => {
    server = app.listen(0, () => {
      api = request(server);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Unified Auth Endpoints (/api/auth)', () => {
    it('should expose /register with new schema requirements', async () => {
      const response = await api.post('/api/auth/register').send({
        email: 'invalid-email',
        password: '123'
      });
      expect(response.status).toBe(400);
    });

    it('should expose /login', async () => {
      const response = await api.post('/api/auth/login').send({
        email: 'test-auth-login@example.com',
        password: 'password123'
      });
      expect(response.status).not.toBe(404);
    });

    it('should expose /me (protected)', async () => {
      const response = await api.get('/api/auth/me');
      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe('test@example.com');
    });
  });

  describe('Backward Compatibility Alias (/api/auth/v2)', () => {
    it('should redirect /api/auth/v2/register to consolidated logic', async () => {
      const response = await api.post('/api/auth/v2/register').send({
        email: 'test@example.com'
      });
      expect(response.status).not.toBe(404);
    });

    it('should expose /api/auth/v2/me', async () => {
      const response = await api.get('/api/auth/v2/me');
      expect(response.status).toBe(200);
    });
  });
});
