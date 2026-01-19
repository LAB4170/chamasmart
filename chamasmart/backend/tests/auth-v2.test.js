/**
 * Auth V2 Integration Tests
 * Tests all multi-option authentication flows
 */

const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

describe('Auth V2 - Multi-Option Authentication', () => {
  let signupToken = '';
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query('DELETE FROM otp_audit WHERE contact_info LIKE \'%test%\'');
      await pool.query('DELETE FROM users WHERE email LIKE \'%test%\'');
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist yet)');
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  // =========================================================================
  // STEP 1: INITIATE SIGNUP WITH EMAIL
  // =========================================================================

  describe('POST /api/auth/v2/signup/start', () => {
    it('should initiate email signup', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'email',
          email: 'testuser@example.com',
          name: 'Test User'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.signupToken).toBeDefined();
      expect(response.body.data.expiresIn).toBe(600); // 10 minutes

      signupToken = response.body.data.signupToken;
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'email',
          email: 'invalidemail'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate email', async () => {
      // First signup
      await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'email',
          email: 'duplicate@example.com',
          name: 'First User'
        });

      // Second signup with same email
      const response = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'email',
          email: 'duplicate@example.com',
          name: 'Second User'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should initiate phone signup', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'phone',
          phone: '712345678',
          name: 'Phone User'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.signupToken).toBeDefined();
    });

    it('should reject invalid auth method', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'invalid',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // STEP 2: VERIFY OTP AND CREATE ACCOUNT
  // =========================================================================

  describe('POST /api/auth/v2/signup/verify-otp', () => {
    let testSignupToken = '';
    let testOtp = '';

    beforeAll(async () => {
      // Start a signup to get token and OTP
      const startResponse = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'email',
          email: 'otp-test@example.com',
          name: 'OTP Test User'
        });

      testSignupToken = startResponse.body.data.signupToken;

      // In development, OTP is logged in the response or Redis
      // For testing, we need to get it from Redis
      const redis = require('../config/redis');
      const sessionData = await redis.get(`signup:${testSignupToken}`);
      testOtp = JSON.parse(sessionData).otp;
    });

    it('should verify OTP and create account', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/verify-otp')
        .send({
          signupToken: testSignupToken,
          otp: testOtp,
          password: 'SecurePassword123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      accessToken = response.body.data.tokens.accessToken;
      refreshToken = response.body.data.tokens.refreshToken;
    });

    it('should reject invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/verify-otp')
        .send({
          signupToken: testSignupToken,
          otp: '000000'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject expired signup token', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/verify-otp')
        .send({
          signupToken: 'invalid-token',
          otp: '123456'
        });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // STEP 3: GOOGLE OAUTH
  // =========================================================================

  describe('POST /api/auth/v2/signup/google', () => {
    it('should handle Google OAuth token', async () => {
      // Note: This would require a valid Google token
      // In testing, we'd mock the Google verification
      const response = await request(app)
        .post('/api/auth/v2/signup/google')
        .send({
          googleToken: 'mock-google-token'
        });

      // Expected to fail with invalid token in development
      expect([400, 401]).toContain(response.status);
    });

    it('should reject missing Google token', async () => {
      const response = await request(app)
        .post('/api/auth/v2/signup/google')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // REFRESH TOKEN
  // =========================================================================

  describe('POST /api/auth/v2/refresh-token', () => {
    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/auth/v2/refresh-token')
        .send({
          refreshToken: refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBe(3600);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/v2/refresh-token')
        .send({
          refreshToken: 'invalid-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/v2/refresh-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // API KEYS
  // =========================================================================

  describe('API Key Management', () => {
    let apiKeyId = '';
    let apiKey = '';

    it('should create API key', async () => {
      const response = await request(app)
        .post('/api/auth/v2/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test API Key',
          expiresInDays: 365
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.keyId).toBeDefined();

      apiKey = response.body.data.apiKey;
      apiKeyId = response.body.data.keyId;
    });

    it('should list API keys', async () => {
      const response = await request(app)
        .get('/api/auth/v2/api-keys')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.keys)).toBe(true);
    });

    it('should authenticate with API key', async () => {
      const response = await request(app)
        .get('/api/auth/v2/profile')
        .set('Authorization', `Bearer ${apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.data.authenticatedVia).toBe('api-key');
    });

    it('should revoke API key', async () => {
      const response = await request(app)
        .delete(`/api/auth/v2/api-keys/${apiKeyId}/revoke`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // =========================================================================
  // RATE LIMITING
  // =========================================================================

  describe('Rate Limiting', () => {
    it('should rate limit signup attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/v2/signup/start')
          .send({
            authMethod: 'email',
            email: `ratelimit${i}@example.com`
          });
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/v2/signup/start')
        .send({
          authMethod: 'email',
          email: 'ratelimit-blocked@example.com'
        });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // HEALTH CHECK
  // =========================================================================

  describe('GET /api/auth/v2/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/auth/v2/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Auth service is operational');
    });
  });
});
