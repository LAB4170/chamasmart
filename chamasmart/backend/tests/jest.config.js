// Base configuration that can be extended
module.exports = {
  // Test environment
  testEnvironment: "node",

  // Test file patterns
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"],

  // Module name mapper for path aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/../$1",
    "^@controllers/(.*)$": "<rootDir>/../controllers/$1",
    "^@models/(.*)$": "<rootDir>/../models/$1",
    "^@utils/(.*)$": "<rootDir>/../utils/$1",
    "^@config/(.*)$": "<rootDir>/../config/$1",
    "^@middleware/(.*)$": "<rootDir>/../middleware/$1",
    "^@tests/(.*)$": "<rootDir>/$1",
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/setup.js"],

  // Test coverage
  collectCoverage: true,
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: [
    "../**/*.js",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/migrations/**",
    "!**/scripts/**",
    "!jest.config.js",
    "!setup.js",
  ],

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Transform configuration
  transform: {
    "^.+\\.js$": "babel-jest",
  },

  // Ignore patterns
  testPathIgnorePatterns: ["/node_modules/"],
};
