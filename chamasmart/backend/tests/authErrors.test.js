const { register, login } = require('../controllers/authController');
const pool = require('../config/db');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth controller error handling', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalQuery = pool.query;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    pool.query = originalQuery;
  });

  it('hides internal error details in production for register', async () => {
    process.env.NODE_ENV = 'production';
    pool.query = jest.fn(() => {
      throw new Error('DB connection failed');
    });

    const req = {
      body: {
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '0712345678',
      },
    };

    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body).not.toHaveProperty('error');
  });

  it('includes error details in non-production for register', async () => {
    process.env.NODE_ENV = 'development';
    pool.query = jest.fn(() => {
      throw new Error('DB connection failed');
    });

    const req = {
      body: {
        email: 'devtest@example.com',
        password: 'Test123!@#',
        firstName: 'Dev',
        lastName: 'User',
        phoneNumber: '0712345678',
      },
    };

    const res = makeRes();
    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toContain('DB connection failed');
    expect(body.error).toBe('DB connection failed');
  });

  it('hides internal error details in production for login', async () => {
    process.env.NODE_ENV = 'production';
    pool.query = jest.fn(() => {
      throw new Error('DB connection failed');
    });

    const req = {
      body: {
        email: 'login@example.com',
        password: 'Test123!@#',
      },
    };

    const res = makeRes();
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body).not.toHaveProperty('error');
  });
});
