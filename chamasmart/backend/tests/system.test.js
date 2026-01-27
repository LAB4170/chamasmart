const request = require('supertest');
const app = require('../server');

describe('System Health and Metrics', () => {
  describe('GET /api/ping', () => {
    it('should return pong response', async () => {
      const response = await request(app)
        .get('/api/ping')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('pong');
    });
  });

  describe('GET /api/health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBeDefined();
      expect(response.body.services.redis).toBeDefined();
      expect(response.body.services.memory).toBeDefined();
    });
  });

  describe('GET /api/metrics', () => {
    it('should require authentication for metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('should return metrics for authenticated user', async () => {
      // Create and authenticate a user
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'metricstest@example.com',
        password: 'SecurePass123!'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      const token = registerResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.requests).toBeDefined();
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.cache).toBeDefined();
      expect(response.body.data.system).toBeDefined();
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger documentation', async () => {
      const response = await request(app)
        .get('/api-docs')
        .expect(200);

      expect(response.text).toContain('swagger');
      expect(response.text).toContain('ChamaSmart API Documentation');
    });

    it('should serve Swagger JSON spec', async () => {
      const response = await request(app)
        .get('/api-docs.json')
        .expect(200);

      expect(response.body.openapi).toBeDefined();
      expect(response.body.info).toBeDefined();
      expect(response.body.paths).toBeDefined();
      expect(response.body.components).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(100).fill().map(() => 
        request(app).get('/api/ping')
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/ping')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should prevent XSS attacks', async () => {
      const xssPayload = {
        email: 'test@example.com',
        password: '<script>alert("xss")</script>'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(xssPayload);

      // The response should not contain the script tag
      expect(response.text).not.toContain('<script>');
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/ping')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', async () => {
      const userData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'invalid-email-format',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('email');
    });

    it('should validate required fields', async () => {
      const userData = {
        first_name: 'Test',
        // missing last_name, email, password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should sanitize input to prevent SQL injection', async () => {
      const sqlInjectionPayload = {
        email: "'; DROP TABLE users; --",
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(sqlInjectionPayload);

      // Should return authentication error, not database error
      expect([401, 400]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/ping')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      // Should respond within 100ms for a simple ping
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 50;
      const promises = Array(concurrentRequests).fill().map(() => 
        request(app).get('/api/ping')
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(1000);
    });
  });
});
