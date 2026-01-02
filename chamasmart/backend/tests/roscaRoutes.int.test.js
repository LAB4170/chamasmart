const request = require('supertest');

jest.mock('../config/db');
const db = require('../config/db');

// Mock auth middleware: always attach a logged-in user, let controller enforce membership
jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { user_id: 999, email: 'test@example.com' };
    next();
  },
  authorize: () => (req, res, next) => next(),
  isOfficial: (req, res, next) => next(),
  isTreasurer: (req, res, next) => next(),
}));

let app;

beforeAll(() => {
  // Ensure pool.connect() returns a client with query/release when used
  db.connect.mockImplementation(async () => ({
    query: db.__mockClientQuery,
    release: jest.fn(),
  }));

  app = require('../server');
});

beforeEach(() => {
  db.__mockQuery.mockReset();
  db.__mockClientQuery.mockReset();
});

const membershipQueryMatch = (text) =>
  text.includes('FROM rosca_cycles rc') &&
  text.includes('JOIN chama_members cm');

const rosterQueryMatch = (text) =>
  text.includes('FROM rosca_roster rr') &&
  text.includes('JOIN users u');

describe('ROSCA routes integration - roster security', () => {
  test('denies roster access for non-member (403)', async () => {
    db.__mockQuery.mockImplementation(async (text, params) => {
      if (membershipQueryMatch(text)) {
        // User is not a member of the chama for this cycle
        return { rows: [] };
      }
      // We should not reach the roster query on unauthorized path
      throw new Error(`Unexpected query in unauthorized roster test: ${text}`);
    });

    const res = await request(app)
      .get('/api/rosca/cycles/123/roster')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  test('authorized member can see roster without PII (no phone_number/trust_score)', async () => {
    db.__mockQuery.mockImplementation(async (text, params) => {
      if (membershipQueryMatch(text)) {
        // User is a valid active member of the cycle's chama
        return { rows: [{ exists: 1 }] };
      }

      if (rosterQueryMatch(text)) {
        // Simulate a single roster entry
        return {
          rows: [
            {
              roster_id: 1,
              cycle_id: 123,
              user_id: 10,
              position: 1,
              payout_amount: 1000,
              status: 'PENDING',
              first_name: 'Alice',
              last_name: 'Mwangi',
              // phone_number and trust_score intentionally NOT included in query now
            },
          ],
        };
      }

      throw new Error(`Unexpected query in authorized roster test: ${text}`);
    });

    const res = await request(app)
      .get('/api/rosca/cycles/123/roster')
      .set('Authorization', 'Bearer fake-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    const entry = res.body.data[0];
    expect(entry.first_name).toBe('Alice');
    expect(entry.last_name).toBe('Mwangi');
    // Critical: ensure PII fields are not present
    expect(entry.phone_number).toBeUndefined();
    expect(entry.trust_score).toBeUndefined();
  });
});
