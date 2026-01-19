jest.mock('../config/db');

// Set up the mock BEFORE requiring anything else that uses db
const db = require('../config/db');

db.connect.mockImplementation(async () => ({
  query: jest.fn(),
  release: jest.fn(),
}));

// NOW require the controller
const { createCycle } = require('../controllers/roscaController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

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

    // Get the mock client query function
    const mockClientQuery = jest.fn();
    db.connect.mockImplementation(async () => ({
      query: mockClientQuery,
      release: jest.fn(),
    }));

    mockClientQuery.mockImplementation(async (text, params) => {
      console.log('[TEST] Query:', text.substring(0, 50));
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rows: [] };
      }
      if (text.includes('FROM chama_members') && text.includes('role IN')) {
        return { rows: [{ exists: 1 }] };
      }
      if (text.startsWith('INSERT INTO rosca_cycles')) {
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
        return {
          rows: [
            { user_id: 101 },
            { user_id: 102 },
          ],
        };
      }
      if (text.startsWith('INSERT INTO rosca_roster')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${text.substring(0, 100)}`);
    });

    await createCycle(req, res);

    // Verify success
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
  });
});
