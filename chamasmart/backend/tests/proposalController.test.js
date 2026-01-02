const { castVote } = require('../controllers/proposalController');

jest.mock('../config/db');
const db = require('../config/db');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('ProposalController.castVote - membership-checked voting', () => {
  beforeEach(() => {
    db.__mockQuery.mockReset();
    db.__mockClientQuery.mockReset();
  });

  test('rejects vote from non-member', async () => {
    const req = {
      params: { proposalId: '10' },
      body: { choice: 'YES' },
      user: { user_id: 5 },
    };
    const res = buildRes();
    const next = jest.fn();

    const impl = async (text, params) => {
      if (text.startsWith('SELECT id, chama_id, status, deadline FROM proposals')) {
        return {
          rows: [
            {
              id: 10,
              chama_id: 1,
              status: 'active',
              deadline: null,
            },
          ],
        };
      }

      if (text.includes('FROM chama_members')) {
        return { rows: [] }; // not a member
      }

      throw new Error(`Unexpected query in test: ${text}`);
    };

    db.__mockQuery.mockImplementation(impl);

    await castVote(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'You are not a member of this chama',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('allows member to vote once and rejects duplicate votes', async () => {
    const req = {
      params: { proposalId: '10' },
      body: { choice: 'NO' },
      user: { user_id: 7 },
    };
    const res = buildRes();
    const next = jest.fn();

    let insertedOnce = false;

    const impl = async (text, params) => {
      if (text.startsWith('SELECT id, chama_id, status, deadline FROM proposals')) {
        return {
          rows: [
            {
              id: 10,
              chama_id: 1,
              status: 'active',
              deadline: null,
            },
          ],
        };
      }

      if (text.includes('FROM chama_members')) {
        return { rows: [{ exists: 1 }] }; // is a member
      }

      if (text.startsWith('INSERT INTO votes')) {
        if (!insertedOnce) {
          insertedOnce = true;
          return { rows: [] };
        }
        const err = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }

      throw new Error(`Unexpected query in test: ${text}`);
    };

    db.__mockQuery.mockImplementation(impl);

    // First vote should succeed
    await castVote(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Vote cast' })
    );

    // Reset res for second attempt
    res.status.mockClear();
    res.json.mockClear();

    // Second vote (duplicate) should be rejected
    await castVote(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'You have already voted on this proposal',
      })
    );
  });
});
