const request = require('supertest');
const { pool } = require('../config/db');

// Unmock core services to use real DB/Redis/Logger
jest.unmock('../config/db');
jest.unmock('../config/redis');
jest.unmock('../utils/logger');

// Mock Auth Middleware
jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { user_id: 1, email: 'treasurer@example.com', role: 'TREASURER' };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    res.status(403).json({ message: 'Forbidden' });
  },
}));

// Mock Rate Limiting and Security
const noopMiddleware = (req, res, next) => next();
jest.mock('../security/enhancedRateLimiting', () => ({
  apiLimiter: noopMiddleware,
  loginLimiter: noopMiddleware,
  registerLimiter: noopMiddleware,
  checkLoginRateLimit: jest.fn().mockResolvedValue(false),
  checkOtpRateLimit: jest.fn().mockResolvedValue(false),
  checkPasswordResetRateLimit: jest.fn().mockResolvedValue(false),
}));

jest.mock('../middleware/rateLimiting', () => ({
  applyAuthRateLimiting: noopMiddleware,
  applyRateLimiting: noopMiddleware,
  applyFinancialRateLimiting: noopMiddleware,
}));

const app = require('../server');

describe('Hybrid Payment Flow Verification', () => {
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

  describe('Member Self-Service Submission (MPESA + Proof)', () => {
    it('should allow member to submit contribution with payment proof', async () => {
      const response = await api
        .post('/api/contributions/1/submit')
        .send({
          userId: 3, // Valid member from check_db_data
          amount: 1500,
          paymentMethod: 'MPESA',
          receiptNumber: 'QKJ9H3K2L',
          paymentProof: 'https://storage.googleapis.com/proof/receipt.jpg',
          notes: 'January Contribution'
        });

      if (response.status !== 201) {
        console.log('FAIL submitContribution:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verification_status).toBe('PENDING');
    });
  });

  describe('Official Record Keeping (CASH)', () => {
    it('should allow treasurer to record cash contribution as VERIFIED', async () => {
      const response = await api
        .post('/api/contributions/1/record')
        .send({
          userId: 4, // Valid member
          amount: 2000,
          paymentMethod: 'CASH',
          verificationStatus: 'VERIFIED',
          notes: 'Received in physical meeting'
        });

      if (response.status !== 201) {
        console.log('FAIL recordContribution:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contribution.verification_status).toBe('VERIFIED');
    });
  });

  describe('Official Verification Flow', () => {
    it('should allow official to verify a PENDING contribution', async () => {
      // Get the last contribution to verify it
      const listRes = await api.get('/api/contributions/1?userId=3');
      const lastContribution = listRes.body.data?.[0];

      if (!lastContribution) {
        console.warn('No contribution found to verify');
        return;
      }

      const response = await api
        .post(`/api/contributions/1/verify/${lastContribution.contribution_id}`)
        .send({
          status: 'VERIFIED',
          verificationNotes: 'M-Pesa message confirmed'
        });

      if (response.status !== 200) {
        console.log('FAIL verifyContribution:', JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
