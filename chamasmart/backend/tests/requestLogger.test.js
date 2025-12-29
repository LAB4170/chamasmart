const { sanitizeBody, sanitizeHeaders } = require('../middleware/requestLogger');

describe('Request Logger Middleware', () => {
    describe('sanitizeBody', () => {
        it('should redact password field', () => {
            const body = {
                email: 'test@example.com',
                password: 'secret123',
                name: 'Test User',
            };

            const sanitized = sanitizeBody(body);

            expect(sanitized.email).toBe('test@example.com');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.name).toBe('Test User');
        });

        it('should redact multiple sensitive fields', () => {
            const body = {
                password: 'secret',
                token: 'abc123',
                api_key: 'key123',
                data: 'public',
            };

            const sanitized = sanitizeBody(body);

            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
            expect(sanitized.api_key).toBe('[REDACTED]');
            expect(sanitized.data).toBe('public');
        });

        it('should handle null/undefined body', () => {
            expect(sanitizeBody(null)).toBe(null);
            expect(sanitizeBody(undefined)).toBe(undefined);
            expect(sanitizeBody({})).toEqual({});
        });
    });

    describe('sanitizeHeaders', () => {
        it('should partially redact authorization header', () => {
            const headers = {
                authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.long.token',
                'content-type': 'application/json',
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized.authorization).toContain('Bearer eyJhbGciOi...');
            expect(sanitized['content-type']).toBe('application/json');
        });

        it('should redact cookie header', () => {
            const headers = {
                cookie: 'session=abc123; user=test',
                host: 'localhost',
            };

            const sanitized = sanitizeHeaders(headers);

            expect(sanitized.cookie).toBe('[REDACTED]');
            expect(sanitized.host).toBe('localhost');
        });
    });
});
