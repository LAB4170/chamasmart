jest.mock('../config/db');
const db = require('../config/db');

// Ensure pool.connect() and pool.query are mocked before requiring the controller
db.connect.mockImplementation(async () => ({
  query: db.__mockClientQuery,
  release: jest.fn(),
}));
db.query = db.__mockQuery;

let buyShares;
let getMyEquity;

({ buyShares, getMyEquity } = require('../controllers/ascaController'));

beforeEach(() => {
  // Reset and re-establish mocks before each test
  db.connect.mockImplementation(async () => ({
    query: db.__mockClientQuery,
    release: jest.fn(),
  }));
  db.query = db.__mockQuery;
});

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('ASCA Controller - buyShares', () => {
  beforeEach(() => {
    db.__mockQuery.mockReset();
    db.__mockClientQuery.mockReset();
  });

  test('rejects invalid payment method', async () => {
    const req = {
      params: { chamaId: '1' },
      body: { amount: 1000, paymentMethod: 'INVALID' },
      user: { user_id: 42 },
    };
    const res = buildRes();
    const next = jest.fn();

    const impl = jest.fn(async () => ({ rows: [] }));
    db.__mockQuery.mockImplementation(impl);
    db.__mockClientQuery.mockImplementation(impl);

    await buyShares(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Invalid payment method',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('creates share purchase with valid payment method and computes shares', async () => {
    const req = {
      params: { chamaId: '1' },
      body: { amount: 1000, paymentMethod: 'mpesa' },
      user: { user_id: 10 },
    };
    const res = buildRes();
    const next = jest.fn();

    const impl = async (text, params) => {
      if (text.startsWith('SELECT chama_id, chama_type')) {
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

      // Fallback: log and return empty result for any query we did not explicitly stub
      // so tests remain focused on the ASCA flows we care about.
      // eslint-disable-next-line no-console
      console.log('ASCA unit test: unexpected query:', text);
      return { rows: [] };
    };

    db.__mockQuery.mockImplementation(impl);
    db.__mockClientQuery.mockImplementation(impl);

    await buyShares(req, res, next);

    if (next.mock.calls.length) {
      // eslint-disable-next-line no-console
      console.log('ASCA unit test buyShares error:', next.mock.calls[0][0]);
    }

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];

    expect(payload.success).toBe(true);
    expect(payload.data.sharePrice).toBe(100);
    expect(payload.data.sharesBought).toBeCloseTo(10);
    expect(payload.data.contribution.payment_method).toBe('MPESA');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('ASCA Controller - getMyEquity', () => {
  beforeEach(() => {
    db.__mockQuery.mockReset();
    db.__mockClientQuery.mockReset();
  });

  test('computes equity based on total assets and shares', async () => {
    const req = {
      params: { chamaId: '1' },
      user: { user_id: 10 },
    };
    const res = buildRes();
    const next = jest.fn();

    const impl = async (text, params) => {
      if (text.startsWith('SELECT chama_id, chama_type')) {
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
      console.log('ASCA unit test (getMyEquity): unexpected query:', text);
      return { rows: [] };
    };

    db.__mockQuery.mockImplementation(impl);
    db.__mockClientQuery.mockImplementation(impl);

    await getMyEquity(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];

    expect(payload.success).toBe(true);
    expect(payload.data.totalAmount).toBe(1000);
    expect(payload.data.totalShares).toBe(10);
    // totalAssets = 2000 (fund) + 8000 (assets) = 10000; sharePrice = 10000 / 100 = 100
    expect(payload.data.currentSharePrice).toBe(100);
    expect(payload.data.estimatedValue).toBe(1000);
    expect(payload.data.totalAssets).toBe(10000);
    expect(next).not.toHaveBeenCalled();
  });
});
