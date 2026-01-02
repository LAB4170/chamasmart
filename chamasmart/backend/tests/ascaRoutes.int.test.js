const request = require('supertest');

jest.mock('../config/db');
const db = require('../config/db');

// Mock auth middleware to inject a test user and bypass real JWT/role checks
jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    // Attach a fake authenticated user
    req.user = { user_id: 10, email: 'test@example.com' };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    // In these tests, treat the user as an allowed member/official
    req.memberRole = 'TREASURER';
    next();
  },
  isOfficial: (req, res, next) => {
    req.memberRole = 'CHAIRPERSON';
    next();
  },
  isTreasurer: (req, res, next) => {
    req.memberRole = 'TREASURER';
    next();
  },
}));

let app;

// Ensure pool.connect() always returns a client with query/release during these tests
// and load the server only after mocks are in place.
beforeAll(() => {
  db.connect.mockImplementation(async () => ({
    query: db.__mockClientQuery,
    release: jest.fn(),
  }));

  app = require('../server');
});

const RESET_DB_MOCKS = () => {
  db.__mockQuery.mockReset();
  db.__mockClientQuery.mockReset();
};

describe('ASCA routes integration (/api/asca)', () => {
  beforeEach(() => {
    RESET_DB_MOCKS();
  });

  test('POST /api/asca/:chamaId/buy-shares creates a share purchase with normalized payment method', async () => {
    const impl = async (text, params) => {
      if (text.startsWith('SELECT chama_id, chama_type') && text.includes('FROM chamas')) {
        // getAscaChama
        return {
          rows: [
            {
              chama_id: 1,
              chama_type: 'ASCA',
              current_fund: 0,
              share_price: 100,
            },
          ],
        };
      }

      if (text.startsWith('SELECT contribution_amount, share_price FROM chamas')) {
        return {
          rows: [
            { contribution_amount: null, share_price: 100 },
          ],
        };
      }

      if (text.startsWith('SELECT user_id FROM chama_members')) {
        return { rows: [{ user_id: 10 }] };
      }

      if (text.startsWith('INSERT INTO contributions')) {
        return {
          rows: [
            {
              contribution_id: 1,
              amount: params[2],
              payment_method: params[3],
              contribution_date: new Date().toISOString(),
            },
          ],
        };
      }

      if (text.startsWith('UPDATE chamas SET current_fund')) {
        return { rows: [] };
      }

      if (text.startsWith('UPDATE chama_members SET total_contributions')) {
        return { rows: [] };
      }

      if (text.startsWith('INSERT INTO asca_share_contributions')) {
        return {
          rows: [
            {
              id: 1,
              amount: params[2],
              number_of_shares: params[3],
              transaction_date: new Date().toISOString(),
            },
          ],
        };
      }

      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }

      // Fallback for any other query
      // eslint-disable-next-line no-console
      console.log('ASCA integration test (buy-shares): unexpected query:', text);
      return { rows: [] };
    };

    db.__mockQuery.mockImplementation(impl);
    db.__mockClientQuery.mockImplementation(impl);

    const res = await request(app)
      .post('/api/asca/1/buy-shares')
      .set('Authorization', 'Bearer fake-token')
      .send({ amount: 1000, paymentMethod: 'mpesa' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.sharePrice).toBe(100);
    expect(res.body.data.sharesBought).toBeCloseTo(10);
    expect(res.body.data.contribution.payment_method).toBe('MPESA');
  });

  test('GET /api/asca/:chamaId/equity returns computed equity snapshot', async () => {
    const impl = async (text, params) => {
      if (text.startsWith('SELECT chama_id, chama_type') && text.includes('FROM chamas')) {
        // getAscaChama
        return {
          rows: [
            {
              chama_id: 1,
              chama_type: 'ASCA',
              current_fund: 2000,
              share_price: 100,
            },
          ],
        };
      }

      if (text.includes('FROM asca_share_contributions') && text.includes('WHERE chama_id = $1 AND user_id = $2')) {
        return {
          rows: [
            { total_amount: 1000, total_shares: 10 },
          ],
        };
      }

      if (text.startsWith('SELECT current_fund, share_price FROM chamas')) {
        return {
          rows: [
            { current_fund: 2000, share_price: 100 },
          ],
        };
      }

      if (text.includes('SELECT COALESCE(SUM(number_of_shares)')) {
        return {
          rows: [
            { total_shares: 100 },
          ],
        };
      }

      if (text.includes('SELECT COALESCE(SUM(current_valuation)')) {
        return {
          rows: [
            { total_assets: 8000 },
          ],
        };
      }

      // Fallback for any other query
      // eslint-disable-next-line no-console
      console.log('ASCA integration test (equity): unexpected query:', text);
      return { rows: [] };
    };

    db.__mockQuery.mockImplementation(impl);
    db.__mockClientQuery.mockImplementation(impl);

    const res = await request(app)
      .get('/api/asca/1/equity')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAmount).toBe(1000);
    expect(res.body.data.totalShares).toBe(10);
    // totalAssets = 2000 (fund) + 8000 (assets) = 10000; sharePrice = 10000 / 100 = 100
    expect(res.body.data.currentSharePrice).toBe(100);
    expect(res.body.data.estimatedValue).toBe(1000);
    expect(res.body.data.totalAssets).toBe(10000);
  });
});
