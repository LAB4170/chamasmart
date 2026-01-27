const request = require('supertest');
const app = require('../server');
const { pool } = require('../config/db');

describe('Contribution Management Endpoints', () => {
  let userToken;
  let testUserId;
  let testChamaId;

  beforeAll(async () => {
    // Create and authenticate test user
    const userData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'contribtest@example.com',
      password: 'SecurePass123!'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    userToken = registerResponse.body.data.tokens.accessToken;
    testUserId = registerResponse.body.data.user.user_id;

    // Create a test chama
    const chamaData = {
      chama_name: 'Test Contribution Chama',
      chama_type: 'CHAMA',
      contribution_amount: 5000.00,
      contribution_frequency: 'MONTHLY'
    };

    const chamaResponse = await request(app)
      .post('/api/chamas')
      .set('Authorization', `Bearer ${userToken}`)
      .send(chamaData);

    testChamaId = chamaResponse.body.data.chama.chama_id;

    // Add user as member to the chama
    await pool.query(
      'INSERT INTO memberships (chama_id, user_id, role, status) VALUES ($1, $2, $3, $4)',
      [testChamaId, testUserId, 'MEMBER', 'ACTIVE']
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM contributions WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM memberships WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM chamas WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/contributions', () => {
    it('should make a contribution successfully', async () => {
      const contributionData = {
        chama_id: testChamaId,
        amount: 5000.00,
        contribution_type: 'REGULAR',
        reference: 'Monthly contribution'
      };

      const response = await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contribution.amount).toBe(contributionData.amount);
      expect(response.body.data.contribution.status).toBe('COMPLETED');
    });

    it('should return validation error for invalid amount', async () => {
      const contributionData = {
        chama_id: testChamaId,
        amount: -100, // Negative amount
        contribution_type: 'REGULAR'
      };

      const response = await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('amount');
    });

    it('should return error for non-existent chama', async () => {
      const contributionData = {
        chama_id: 99999,
        amount: 5000.00,
        contribution_type: 'REGULAR'
      };

      const response = await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contributionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return error without authentication', async () => {
      const contributionData = {
        chama_id: testChamaId,
        amount: 5000.00,
        contribution_type: 'REGULAR'
      };

      const response = await request(app)
        .post('/api/contributions')
        .send(contributionData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });

  describe('GET /api/contributions', () => {
    beforeEach(async () => {
      // Create test contributions
      await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          chama_id: testChamaId,
          amount: 3000.00,
          contribution_type: 'REGULAR'
        });

      await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          chama_id: testChamaId,
          amount: 2000.00,
          contribution_type: 'WELFARE'
        });
    });

    it('should get user contributions successfully', async () => {
      const response = await request(app)
        .get('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.contributions)).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.total_amount).toBeGreaterThan(0);
    });

    it('should filter contributions by chama_id', async () => {
      const response = await request(app)
        .get(`/api/contributions?chama_id=${testChamaId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contributions.length).toBeGreaterThan(0);
      response.body.data.contributions.forEach(contribution => {
        expect(contribution.chama_id).toBe(testChamaId);
      });
    });

    it('should filter contributions by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/contributions?start_date=${today}&end_date=${today}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.contributions)).toBe(true);
    });

    it('should return error without authentication', async () => {
      const response = await request(app)
        .get('/api/contributions')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });

  describe('GET /api/contributions/:id', () => {
    let contributionId;

    beforeEach(async () => {
      // Create a test contribution
      const contributionResponse = await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          chama_id: testChamaId,
          amount: 4000.00,
          contribution_type: 'REGULAR'
        });

      contributionId = contributionResponse.body.data.contribution.contribution_id;
    });

    it('should get contribution by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contribution.contribution_id).toBe(contributionId);
      expect(response.body.data.contribution.amount).toBe(4000.00);
    });

    it('should return error for non-existent contribution', async () => {
      const response = await request(app)
        .get('/api/contributions/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return error for unauthorized access', async () => {
      // Create another user
      const otherUserData = {
        first_name: 'Other',
        last_name: 'User',
        email: 'othercontrib@example.com',
        password: 'SecurePass123!'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherToken = otherUserResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .get(`/api/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('authorized');
    });
  });

  describe('PUT /api/contributions/:id', () => {
    let contributionId;

    beforeEach(async () => {
      // Create a test contribution
      const contributionResponse = await request(app)
        .post('/api/contributions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          chama_id: testChamaId,
          amount: 3000.00,
          contribution_type: 'REGULAR'
        });

      contributionId = contributionResponse.body.data.contribution.contribution_id;
    });

    it('should update contribution successfully', async () => {
      const updateData = {
        amount: 3500.00,
        reference: 'Updated contribution'
      };

      const response = await request(app)
        .put(`/api/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contribution.amount).toBe(updateData.amount);
      expect(response.body.data.contribution.reference).toBe(updateData.reference);
    });

    it('should return error for updating completed contribution', async () => {
      // First complete the contribution
      await request(app)
        .put(`/api/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'COMPLETED' });

      // Try to update again
      const updateData = {
        amount: 4000.00
      };

      const response = await request(app)
        .put(`/api/contributions/${contributionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already completed');
    });
  });
});
