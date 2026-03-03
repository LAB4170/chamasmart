const request = require('supertest');

// MOCKING MUST HAPPEN BEFORE ANY OTHER IMPORTS
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

// Mock Auth Middleware
let currUserId = 1;
let currRole = 'TREASURER';

jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { user_id: currUserId, email: 'test@example.com', role: currRole };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    if (roles.includes(currRole)) return next();
    res.status(403).json({ success: false, message: 'Forbidden' });
  },
}));

// Unmock core services
jest.unmock('../config/db');
jest.unmock('../config/redis');
jest.unmock('../utils/logger');

const app = require('../server');
const pool = require('../config/db');

describe('Bulk Contribution Recording', () => {
  let server;
  let api;
  let token;
  let chamaId = '1';
  let memberId2 = '2';
  let memberId3 = '3';

  beforeAll((done) => {
    server = app.listen(0, () => {
      api = request(server);
      token = 'mocked-token'; // Authentication is mocked
      done();
    });
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end();
  });

  it('should record multiple contributions atomically', async () => {
    const payload = {
      contributions: [
        {
          userId: memberId2,
          amount: 500,
          paymentMethod: 'CASH',
          verificationStatus: 'VERIFIED',
          notes: 'Bulk 1'
        },
        {
          userId: memberId3,
          amount: 1000,
          paymentMethod: 'CASH',
          verificationStatus: 'VERIFIED',
          notes: 'Bulk 2'
        }
      ]
    };

    const res = await api
      .post(`/api/contributions/${chamaId}/bulk-record`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    if (res.status !== 201) {
      console.log('FAIL bulk-record:', JSON.stringify(res.body, null, 2));
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.totalAmount).toBe(1500);
  });

  it('should rollback all if one contribution fails (Duplicate detection)', async () => {
    currRole = 'TREASURER';
    currUserId = 1;

    // Record one to trigger duplicate
    const preRes = await api
      .post(`/api/contributions/${chamaId}/record`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: memberId2,
        amount: 250,
        paymentMethod: 'CASH',
        notes: 'Pre-duplicate'
      });

    const payload = {
      contributions: [
        {
          userId: memberId3,
          amount: 100,
          paymentMethod: 'CASH',
          notes: 'Rollback target'
        },
        {
          userId: memberId2,
          amount: 250, // Duplicate
          paymentMethod: 'CASH'
        }
      ]
    };

    const res = await api
      .post(`/api/contributions/${chamaId}/bulk-record`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(409);
    
    // Verify member 3's contribution wasn't recorded
    const checkRes = await api
      .get(`/api/contributions/${chamaId}?userId=${memberId3}`)
      .set('Authorization', `Bearer ${token}`);
    
    // Check if any contribution has the notes 'Rollback target'
    // checkRes.body.data is an array of contributions
    const member3Contributions = (checkRes.body.data || []).filter(c => c.notes === 'Rollback target');
    expect(member3Contributions.length).toBe(0);
  });

  it('should reject bulk recording from non-officials', async () => {
    currRole = 'MEMBER';
    currUserId = 3;

    const res = await api
      .post(`/api/contributions/${chamaId}/bulk-record`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contributions: [{ userId: '2', amount: 100 }] });

    expect(res.status).toBe(403);
  });
});
