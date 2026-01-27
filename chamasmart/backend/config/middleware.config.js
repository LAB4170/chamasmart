/**
 * Centralized Middleware Configuration
 * All configurable values in one place
 */

module.exports = {
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 5,
    registerMax: parseInt(process.env.RATE_LIMIT_REGISTER_MAX) || 3,
    passwordResetMax: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_MAX) || 3,
    createResourceMax: parseInt(process.env.RATE_LIMIT_CREATE_MAX) || 10,
    uploadMax: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX) || 20,
    perUserMax: parseInt(process.env.RATE_LIMIT_PER_USER_MAX) || 30,
    expensiveMax: parseInt(process.env.RATE_LIMIT_EXPENSIVE_MAX) || 5,
  },

  // Caching
  cache: {
    defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL) || 300, // 5 minutes
    chamaDetailsTtl: parseInt(process.env.CACHE_CHAMA_DETAILS_TTL) || 300,
    chamaListTtl: parseInt(process.env.CACHE_CHAMA_LIST_TTL) || 120,
    userProfileTtl: parseInt(process.env.CACHE_USER_PROFILE_TTL) || 600,
    dashboardStatsTtl: parseInt(process.env.CACHE_DASHBOARD_STATS_TTL) || 300,
    contributionsTtl: parseInt(process.env.CACHE_CONTRIBUTIONS_TTL) || 60,
    meetingsTtl: parseInt(process.env.CACHE_MEETINGS_TTL) || 300,
    loansTtl: parseInt(process.env.CACHE_LOANS_TTL) || 120,
    maxSize: process.env.CACHE_MAX_SIZE || '100mb',
    compressionThreshold:
      parseInt(process.env.CACHE_COMPRESSION_THRESHOLD) || 1024, // 1KB
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    maxFiles: parseInt(process.env.MAX_FILES) || 5,
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
  },

  // Security
  security: {
    csrfEnabled: process.env.CSRF_ENABLED !== 'false', // Enabled by default
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30 seconds
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE) || 10 * 1024 * 1024, // 10MB
    trustedProxies: process.env.TRUSTED_PROXIES?.split(',') || [],
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '1d',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    maxApiKeysPerUser: parseInt(process.env.MAX_API_KEYS_PER_USER) || 10,
    apiKeyDefaultExpiry:
      parseInt(process.env.API_KEY_DEFAULT_EXPIRY_DAYS) || 365,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  },

  // Validation
  validation: {
    maxSearchLength: parseInt(process.env.MAX_SEARCH_LENGTH) || 200,
    maxFieldLength: parseInt(process.env.MAX_FIELD_LENGTH) || 50,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 100,
    maxOffset: parseInt(process.env.MAX_OFFSET) || 10000,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableDetailedLogging: process.env.DETAILED_LOGGING === 'true',
    logSamplingRate: parseFloat(process.env.LOG_SAMPLING_RATE) || 1.0, // 1.0 = 100%
    sensitiveFields: [
      'password',
      'password_hash',
      'token',
      'authorization',
      'cookie',
      'jwt',
      'secret',
      'api_key',
      'apiKey',
      'ssn',
      'credit_card',
    ],
  },

  // Metrics
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    authToken: process.env.METRICS_AUTH_TOKEN,
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 1000, // 1 second
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    url: process.env.REDIS_URL,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'chamasmart:',
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY) || 50,
  },

  // Circuit Breaker
  circuitBreaker: {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 3000,
    errorThresholdPercentage:
      parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD) || 50,
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 30000,
  },

  // HTTP Cache Control
  httpCache: {
    publicEndpointMaxAge:
      parseInt(process.env.HTTP_CACHE_PUBLIC_MAX_AGE) || 3600, // 1 hour
    privateEndpointMaxAge:
      parseInt(process.env.HTTP_CACHE_PRIVATE_MAX_AGE) || 300, // 5 minutes
    listEndpointMaxAge: parseInt(process.env.HTTP_CACHE_LIST_MAX_AGE) || 300,
  },

  // Member Status
  memberStatus: {
    ACTIVE: 'active',
    PENDING: 'pending',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
  },

  // User Roles
  roles: {
    CHAIRPERSON: 'CHAIRPERSON',
    SECRETARY: 'SECRETARY',
    TREASURER: 'TREASURER',
    MEMBER: 'MEMBER',
  },
};
