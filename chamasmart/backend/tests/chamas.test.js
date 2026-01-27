const request = require('supertest');
const app = require('../server');
const { pool } = require('../config/db');

describe('Chama Management Endpoints', () => {
  let userToken;
  let testUserId;
  let testChamaId;

  beforeAll(async () => {
    // Create and authenticate test user
    const userData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'chamatest@example.com',
      password: 'SecurePass123!',
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    userToken = registerResponse.body.data.tokens.accessToken;
    testUserId = registerResponse.body.data.user.user_id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM chamas WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/chamas', () => {
    it('should create a new chama successfully', async () => {
      const chamaData = {
        chama_name: 'Test Investment Group',
        chama_type: 'CHAMA',
        description: 'A test chama for investment',
        contribution_amount: 5000.00,
        contribution_frequency: 'MONTHLY',
        meeting_day: 'Saturday',
        meeting_time: '14:00',
        visibility: 'PUBLIC',
      };

      const response = await request(app)
        .post('/api/chamas')
        .set('Authorization', `Bearer ${userToken}`)
        .send(chamaData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chama.chama_name).toBe(chamaData.chama_name);
      expect(response.body.data.chama.chama_type).toBe(chamaData.chama_type);

      testChamaId = response.body.data.chama.chama_id;
    });

    it('should return validation error for missing required fields', async () => {
      const chamaData = {
        description: 'Incomplete chama data',
        // missing chama_name, chama_type, contribution_amount
      };

      const response = await request(app)
        .post('/api/chamas')
        .set('Authorization', `Bearer ${userToken}`)
        .send(chamaData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return error for invalid chama type', async () => {
      const chamaData = {
        chama_name: 'Invalid Chama',
        chama_type: 'INVALID_TYPE',
        contribution_amount: 5000.00,
      };

      const response = await request(app)
        .post('/api/chamas')
        .set('Authorization', `Bearer ${userToken}`)
        .send(chamaData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('chama_type');
    });

    it('should return error without authentication', async () => {
      const chamaData = {
        chama_name: 'Unauthorized Chama',
        chama_type: 'CHAMA',
        contribution_amount: 5000.00,
      };

      const response = await request(app)
        .post('/api/chamas')
        .send(chamaData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });

  describe('GET /api/chamas', () => {
    it('should get public chamas successfully', async () => {
      const response = await request(app)
        .get('/api/chamas')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.chamas)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/chamas?page=1&limit=5')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/api/chamas?search=Test')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.chamas)).toBe(true);
    });

    it('should return error without authentication', async () => {
      const response = await request(app)
        .get('/api/chamas')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });

  describe('GET /api/chamas/:id', () => {
    it('should get chama by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/chamas/${testChamaId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chama.chama_id).toBe(testChamaId);
      expect(response.body.data.chama.chama_name).toBe('Test Investment Group');
    });

    it('should return error for non-existent chama', async () => {
      const response = await request(app)
        .get('/api/chamas/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return error without authentication', async () => {
      const response = await request(app)
        .get(`/api/chamas/${testChamaId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });

  describe('PUT /api/chamas/:id', () => {
    it('should update chama successfully', async () => {
      const updateData = {
        chama_name: 'Updated Test Group',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/chamas/${testChamaId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chama.chama_name).toBe(updateData.chama_name);
      expect(response.body.data.chama.description).toBe(updateData.description);
    });

    it('should return error for unauthorized update', async () => {
      // Create another user
      const otherUserData = {
        first_name: 'Other',
        last_name: 'User',
        email: 'other@example.com',
        password: 'SecurePass123!',
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherToken = otherUserResponse.body.data.tokens.accessToken;

      const updateData = {
        chama_name: 'Hijacked Group',
      };

      const response = await request(app)
        .put(`/api/chamas/${testChamaId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('authorized');
    });
  });

  describe('DELETE /api/chamas/:id', () => {
    it('should soft delete chama successfully', async () => {
      const response = await request(app)
        .delete(`/api/chamas/${testChamaId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should return error for already deleted chama', async () => {
      const response = await request(app)
        .delete(`/api/chamas/${testChamaId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });
});
