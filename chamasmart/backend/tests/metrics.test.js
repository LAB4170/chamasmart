const request = require('supertest');
const app = require('../server');

describe('/metrics protection', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalToken = process.env.METRICS_AUTH_TOKEN;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalToken === undefined) {
      delete process.env.METRICS_AUTH_TOKEN;
    } else {
      process.env.METRICS_AUTH_TOKEN = originalToken;
    }
  });

  it('rejects unauthorized metrics access when token is set in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_AUTH_TOKEN = 'test-metrics-token';

    const res = await request(app).get('/metrics');

    expect(res.statusCode).toBe(403);
    expect(res.text).toBe('Forbidden');
  });

  it('allows metrics access with correct token in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_AUTH_TOKEN = 'test-metrics-token';

    const res = await request(app)
      .get('/metrics')
      .set('x-metrics-token', 'test-metrics-token');

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('chamasmart_http_requests_total');
  });
});
