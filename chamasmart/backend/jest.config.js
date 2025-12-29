module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'controllers/**/*.js',
        'middleware/**/*.js',
        'utils/**/*.js',
        'config/**/*.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/tests/**',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};
