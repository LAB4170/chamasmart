jest.mock('../config/db');
const db = require('../config/db');

let createCycle;
let processPayout;

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeAll(() => {
  // For controller unit tests, we use connect() and a client-only query fn
  db.connect.mockImplementation(async () => ({
    query: db.__mockClientQuery,
    release: jest.fn(),
  }));

  ({ createCycle, processPayout } = require('../controllers/roscaController'));
});

beforeEach(() => {
  db.__mockQuery.mockReset();
  db.__mockClientQuery.mockReset();
});

describe('ROSCA createCycle - parameterized roster insert', () => {
  test('uses parameterized VALUES and correct payout amounts', async () => {
    const req = {
      body: {
        chama_id: 1,
        cycle_name: 'January ROSCA',
        contribution_amount: 100,
        frequency: 'MONTHLY',
        start_date: '2025-01-01',
        roster_method: 'RANDOM',
      },
      user: { user_id: 500 },
    };
    const res = buildRes();

    let rosterInsertCall = null;

    db.__mockClientQuery.mockImplementation(async (text, params) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }

      if (text.includes('FROM chama_members') && text.includes('role IN')) {
        // Authorization check for officials
        return { rows: [{ exists: 1 }] };
      }

      if (text.startsWith('INSERT INTO rosca_cycles')) {
        // Return a single new cycle
        return {
          rows: [
            {
              cycle_id: 10,
              chama_id: 1,
              contribution_amount: 100,
              start_date: new Date('2025-01-01'),
              status: 'PENDING',
            },
          ],
        };
      }

      if (text.includes('FROM chama_members') && text.includes('is_active = true')) {
        // Two active members
        return {
          rows: [
            { user_id: 101 },
            { user_id: 102 },
          ],
        };
      }

      if (text.startsWith('INSERT INTO rosca_roster')) {
        rosterInsertCall = { text, params };
        return { rows: [] };
      }

      throw new Error(`Unexpected query in createCycle test: ${text}`);
    });

    await createCycle(req, res);

    // Ensure success
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();

    // Roster insert must have been called
    expect(rosterInsertCall).not.toBeNull();
    const { text, params } = rosterInsertCall;

    // We expect the INSERT to use parameter placeholders rather than interpolated values
    expect(text).toContain('INSERT INTO rosca_roster');
    expect(text).toContain('$1');

    // With 2 members, we expect 2 * 4 = 8 params: (cycle_id, user_id, position, payout_amount)
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBe(8);

    // Payout amount should be contribution_amount * (member_count - 1) = 100 * 1 = 100
    const payoutAmounts = [params[3], params[7]]; // every 4th parameter
    payoutAmounts.forEach((amt) => {
      expect(amt).toBe(100);
    });
  });
});

describe('ROSCA processPayout - contribution checks', () => {
  test('rejects payout when not all members have paid', async () => {
    const req = {
      params: { cycleId: '10' },
      body: { position: 1, payment_proof: 'mpesa:TX123' },
      user: { user_id: 700 }, // treasurer
    };
    const res = buildRes();

    db.__mockClientQuery.mockImplementation(async (text, params) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }

      if (text.includes('FROM rosca_cycles') && text.includes("status = 'ACTIVE'")) {
        return {
          rows: [
            {
              cycle_id: 10,
              chama_id: 1,
              status: 'ACTIVE',
              start_date: new Date('2025-01-01'),
              contribution_amount: 100,
            },
          ],
        };
      }

      if (text.includes('FROM chama_members') && text.includes("role = 'TREASURER'")) {
        return { rows: [{ exists: 1 }] };
      }

      if (text.includes('FROM rosca_roster') && text.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              roster_id: 1,
              cycle_id: 10,
              user_id: 101,
              position: 1,
              payout_amount: 100,
              status: 'PENDING',
            },
          ],
        };
      }

      if (text.includes('SELECT COUNT(*) FROM rosca_roster') && text.includes('NOT EXISTS')) {
        // Simulate at least one unpaid member
        return { rows: [{ count: '1' }] };
      }

      throw new Error(`Unexpected query in unpaid payout test: ${text}`);
    });

    await processPayout(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/not all members have paid/i),
      })
    );
  });

  test('allows payout when all members have paid at least contribution_amount', async () => {
    const req = {
      params: { cycleId: '10' },
      body: { position: 1, payment_proof: 'mpesa:TX999' },
      user: { user_id: 700 },
    };
    const res = buildRes();

    db.__mockClientQuery.mockImplementation(async (text, params) => {
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }

      if (text.includes('FROM rosca_cycles') && text.includes("status = 'ACTIVE'")) {
        return {
          rows: [
            {
              cycle_id: 10,
              chama_id: 1,
              status: 'ACTIVE',
              start_date: new Date('2025-01-01'),
              contribution_amount: 100,
            },
          ],
        };
      }

      if (text.includes('FROM chama_members') && text.includes("role = 'TREASURER'")) {
        return { rows: [{ exists: 1 }] };
      }

      if (text.includes('FROM rosca_roster') && text.includes('FOR UPDATE')) {
        return {
          rows: [
            {
              roster_id: 1,
              cycle_id: 10,
              user_id: 101,
              position: 1,
              payout_amount: 100,
              status: 'PENDING',
            },
          ],
        };
      }

      if (text.includes('SELECT COUNT(*) FROM rosca_roster') && text.includes('NOT EXISTS')) {
        // No unpaid members
        return { rows: [{ count: '0' }] };
      }

      if (text.startsWith('UPDATE rosca_roster')) {
        return { rows: [] };
      }

      if (text.startsWith('INSERT INTO transactions')) {
        return { rows: [] };
      }

      if (text.includes('SELECT COUNT(*) FROM rosca_roster') && text.includes("status = 'PENDING'")) {
        // Still some pending payouts left (cycle not yet completed)
        return { rows: [{ count: '1' }] };
      }

      throw new Error(`Unexpected query in happy-path payout test: ${text}`);
    });

    await processPayout(req, res);

    // On success, we use default 200 status with a JSON body
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringMatching(/payout processed/i),
      })
    );
  });
});
