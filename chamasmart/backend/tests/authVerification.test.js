jest.mock('../config/db');
const db = require('../config/db');

const {
  verifyEmail,
  verifyPhone,
  resendEmailVerification,
  resendPhoneVerification,
} = require('../controllers/authController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth verification endpoints', () => {
  beforeEach(() => {
    db.__mockQuery.mockReset();
    db.__mockClientQuery.mockReset();
  });

  describe('verifyEmail', () => {
    test('rejects missing token', async () => {
      const req = { body: {} };
      const res = buildRes();

      await verifyEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('verifies email with valid token', async () => {
      const req = { body: { token: 'valid-token' } };
      const res = buildRes();

      db.__mockQuery.mockImplementation(async (text, params) => {
        if (text.startsWith('SELECT user_id') && text.includes('FROM users')) {
          return {
            rows: [
              {
                user_id: 1,
                email_verification_expires_at: new Date(Date.now() + 60_000),
                email_verified: false,
              },
            ],
          };
        }

        if (text.startsWith('UPDATE users') && text.includes('SET email_verified = TRUE')) {
          return { rows: [] };
        }

        throw new Error(`Unexpected query in verifyEmail test: ${text}`);
      });

      await verifyEmail(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('verifyPhone', () => {
    test('rejects missing code', async () => {
      const req = { body: {}, user: { user_id: 1 } };
      const res = buildRes();

      await verifyPhone(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('verifies phone with correct OTP and not expired', async () => {
      const req = { body: { code: '123456' }, user: { user_id: 1 } };
      const res = buildRes();

      db.__mockQuery.mockImplementation(async (text, params) => {
        if (text.startsWith('SELECT phone_verification_code')) {
          return {
            rows: [
              {
                phone_verification_code: '123456',
                phone_verification_expires_at: new Date(Date.now() + 60_000),
                phone_verification_attempts: 0,
                phone_verified: false,
              },
            ],
          };
        }

        if (text.startsWith('UPDATE users') && text.includes('SET phone_verified = TRUE')) {
          return { rows: [] };
        }

        throw new Error(`Unexpected query in verifyPhone test: ${text}`);
      });

      await verifyPhone(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('resendEmailVerification', () => {
    test('returns 404 when user not found', async () => {
      const req = { user: { user_id: 1 } };
      const res = buildRes();

      db.__mockQuery.mockResolvedValueOnce({ rows: [] });

      await resendEmailVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('enforces cooldown when last sent recently', async () => {
      const req = { user: { user_id: 1 } };
      const res = buildRes();

      db.__mockQuery.mockResolvedValueOnce({
        rows: [
          {
            email: 'test@example.com',
            email_verified: false,
            email_verification_last_sent_at: new Date(),
          },
        ],
      });

      await resendEmailVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('resends when outside cooldown window', async () => {
      const req = { user: { user_id: 1 } };
      const res = buildRes();

      // SELECT user row
      db.__mockQuery.mockImplementationOnce(async () => ({
        rows: [
          {
            email: 'test@example.com',
            email_verified: false,
            email_verification_last_sent_at: new Date(Date.now() - 10 * 60 * 1000),
          },
        ],
      }))
      // UPDATE users ... email_verification_token ...
      .mockImplementationOnce(async () => ({ rows: [] }));

      await resendEmailVerification(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('resendPhoneVerification', () => {
    test('returns 404 when user not found', async () => {
      const req = { user: { user_id: 1 } };
      const res = buildRes();

      db.__mockQuery.mockResolvedValueOnce({ rows: [] });

      await resendPhoneVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('enforces cooldown when last SMS sent recently', async () => {
      const req = { user: { user_id: 1 } };
      const res = buildRes();

      db.__mockQuery.mockResolvedValueOnce({
        rows: [
          {
            phone_number: '+254712345678',
            phone_verified: false,
            phone_verification_last_sent_at: new Date(),
          },
        ],
      });

      await resendPhoneVerification(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('resends OTP when outside cooldown window', async () => {
      const req = { user: { user_id: 1 } };
      const res = buildRes();

      // SELECT user row
      db.__mockQuery.mockImplementationOnce(async () => ({
        rows: [
          {
            phone_number: '+254712345678',
            phone_verified: false,
            phone_verification_last_sent_at: new Date(Date.now() - 10 * 60 * 1000),
          },
        ],
      }))
      // UPDATE users ... phone_verification_code ...
      .mockImplementationOnce(async () => ({ rows: [] }));

      await resendPhoneVerification(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});
