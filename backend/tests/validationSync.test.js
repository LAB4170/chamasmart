const request = require('supertest');
const { pool } = require('../config/db');

// Mock Auth Middleware BEFORE requiring app
jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { user_id: 1, email: 'test@example.com', role: 'CHAIRPERSON' };
    next();
  },
  authorize: () => (req, res, next) => next(),
  isOfficial: (req, res, next) => next(),
  isTreasurer: (req, res, next) => next(),
}));

// Mock Enhanced Rate Limiting BEFORE requiring app
jest.mock('../security/enhancedRateLimiting', () => ({
  checkLoginRateLimit: jest.fn().mockResolvedValue(false),
  checkOtpRateLimit: jest.fn().mockResolvedValue(false),
  checkPasswordResetRateLimit: jest.fn().mockResolvedValue(false),
  createRedisStore: jest.fn(),
  apiLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
}));

const app = require('../server');

describe('Validation Schema Synchronization Tests', () => {
  let server;
  let api;

  beforeAll((done) => {
    // Start server on a random port
    server = app.listen(0, () => {
      api = request(server);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('ROSCA createCycleSchema', () => {
    it('should reject requests with camelCase fields (backward compatibility check)', async () => {
      const response = await api
        .post('/api/rosca/chama/1/cycles')
        .send({
          contributionAmount: 1000,
          startDate: '2026-03-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('chama_id'); 
    });

    it('should accept requests with correct snake_case fields', async () => {
      const response = await api
        .post('/api/rosca/chama/1/cycles')
        .send({
          chama_id: 1,
          cycle_name: 'Test Cycle',
          contribution_amount: 1000,
          frequency: 'MONTHLY',
          start_date: '2026-03-02'
        });

      expect(response.status).not.toBe(400);
    });
  });

  describe('ROSCA processPayoutSchema', () => {
    it('should reject old memberId field', async () => {
      const response = await api
        .post('/api/rosca/cycles/1/payout')
        .send({
          memberId: 1,
          amount: 1000
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('position');
    });

    it('should accept position field', async () => {
      const response = await api
        .post('/api/rosca/cycles/1/payout')
        .send({
          position: 1,
          payment_proof: 'https://example.com/receipt.jpg'
        });

      expect(response.status).not.toBe(400);
    });
  });

  describe('ROSCA respondToSwapRequestSchema', () => {
    it('should reject status and accept action', async () => {
      const response = await api
        .put('/api/rosca/swap-requests/1/respond')
        .send({
          status: 'approved'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('action');
    });

    it('should accept uppercase APPROVED action', async () => {
      const response = await api
        .put('/api/rosca/swap-requests/1/respond')
        .send({
          action: 'APPROVED'
        });

      expect(response.status).not.toBe(400);
    });
  });
});
