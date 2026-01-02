const mockQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockConnect = jest.fn(async () => ({
  query: mockClientQuery,
  release: jest.fn(),
}));

module.exports = {
  query: mockQuery,
  connect: mockConnect,
  end: jest.fn(),
  __mockQuery: mockQuery,
  __mockClientQuery: mockClientQuery,
};
