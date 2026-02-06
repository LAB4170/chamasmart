// Test utilities for ChamaSmart backend

const createTestUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  password: 'hashedpassword',
  first_name: 'Test',
  last_name: 'User',
  phone: '+254700000000',
  is_admin: false,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const createTestChama = (overrides = {}) => ({
  id: 1,
  name: 'Test Chama',
  description: 'A test chama group',
  meeting_schedule: 'First Monday of the month',
  contribution_amount: 1000,
  created_by: 1,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const createTestMember = (overrides = {}) => ({
  id: 1,
  user_id: 1,
  chama_id: 1,
  role: 'member',
  joined_at: new Date(),
  status: 'active',
  ...overrides,
});

// Mock Express response object
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

// Mock Express request object
const mockRequest = (
  body = {},
  params = {},
  query = {},
  user = null,
) => ({
  body,
  params,
  query,
  user,
  get: jest.fn(),
  header: jest.fn(),
  ...(user && { user }),
});

// Mock Next function
const mockNext = jest.fn();

module.exports = {
  createTestUser,
  createTestChama,
  createTestMember,
  mockResponse,
  mockRequest,
  mockNext,
};

