const request = require('supertest');
const app = require('../server');

describe('Authentication API', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: `test${Date.now()}@example.com`,
                    password: 'Test123!@#',
                    firstName: 'Test',
                    lastName: 'User',
                    phoneNumber: '1234567890',
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('token');
            expect(res.body.data).toHaveProperty('user_id');
        });

        it('should reject registration with missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    // Missing password
                });

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('success', false);
        });

        it('should reject duplicate email', async () => {
            const email = `duplicate${Date.now()}@example.com`;

            // First registration
            await request(app)
                .post('/api/auth/register')
                .send({
                    email,
                    password: 'Test123!@#',
                    firstName: 'Test',
                    lastName: 'User',
                    phoneNumber: '1234567890',
                });

            // Duplicate registration
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email,
                    password: 'Test123!@#',
                    firstName: 'Test',
                    lastName: 'User',
                    phoneNumber: '1234567890',
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        let testUser;

        beforeAll(async () => {
            // Create test user
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: `logintest${Date.now()}@example.com`,
                    password: 'Test123!@#',
                    firstName: 'Login',
                    lastName: 'Test',
                    phoneNumber: '1234567890',
                });

            testUser = res.body.data;
        });

        it('should login with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'Test123!@#',
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('token');
        });

        it('should reject login with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword',
                });

            expect(res.statusCode).toBe(401);
            expect(res.body).toHaveProperty('success', false);
        });

        it('should reject login with non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'Test123!@#',
                });

            expect(res.statusCode).toBe(401);
        });
    });
});

describe('Health Check API', () => {
    it('should return health status', async () => {
        const res = await request(app).get('/api/health');

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('uptime');
        expect(res.body).toHaveProperty('message', 'OK');
    });
});
