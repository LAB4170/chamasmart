const Joi = require('joi');

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  // Server
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('/api/v1'),
  
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MIN: Joi.number().default(2),
  DB_POOL_MAX: Joi.number().default(10),
  DB_IDLE_TIMEOUT_MS: Joi.number().default(30000),
  DB_CONNECTION_TIMEOUT_MS: Joi.number().default(2000),
  DB_QUERY_TIMEOUT_MS: Joi.number().default(10000),
  
  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow(''),
  REDIS_TLS: Joi.boolean().default(false),
  
  // Security
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  COOKIE_SECRET: Joi.string().required(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().default(100),
  
  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  
  // Monitoring
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_ROUTE: Joi.string().default('/metrics'),
  
  // Feature Flags
  ENABLE_REQUEST_LOGGING: Joi.boolean().default(true),
  ENABLE_RESPONSE_TIME_HEADER: Joi.boolean().default(true),
  
  // External Services
  SENTRY_DSN: Joi.string().allow(''),
  NEW_RELIC_LICENSE_KEY: Joi.string().allow('')
})
  .unknown()
  .required();

const { value: envVars, error } = envVarsSchema.validate(process.env, { 
  abortEarly: false,
  stripUnknown: true 
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const config = {
  env: envVars.NODE_ENV,
  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',
  
  server: {
    port: envVars.PORT,
    apiPrefix: envVars.API_PREFIX,
    enableRequestLogging: envVars.ENABLE_REQUEST_LOGGING,
    enableResponseTimeHeader: envVars.ENABLE_RESPONSE_TIME_HEADER
  },
  
  db: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    pool: {
      min: envVars.DB_POOL_MIN,
      max: envVars.DB_POOL_MAX,
      idleTimeoutMillis: envVars.DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: envVars.DB_CONNECTION_TIMEOUT_MS,
      queryTimeout: envVars.DB_QUERY_TIMEOUT_MS
    },
    ssl: envVars.DB_USE_SSL ? {
      rejectUnauthorized: !envVars.DB_REJECT_UNAUTHORIZED,
      ca: envVars.DB_CA_CERT
    } : false
  },
  
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD || undefined,
    tls: envVars.REDIS_TLS ? { rejectUnauthorized: false } : undefined,
    keyPrefix: `${envVars.NODE_ENV}:`,
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 100, 2000); // Exponential backoff up to 2s
    }
  },
  
  security: {
    jwtSecret: envVars.JWT_SECRET,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN,
    cookieSecret: envVars.COOKIE_SECRET,
    rateLimit: {
      windowMs: envVars.RATE_LIMIT_WINDOW_MS,
      max: envVars.RATE_LIMIT_MAX
    },
    cors: {
      origin: envVars.CORS_ORIGIN 
        ? envVars.CORS_ORIGIN.split(',').map(origin => origin.trim())
        : ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Total-Count'],
      credentials: true,
      maxAge: 86400 // 24 hours
    }
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    format: envVars.NODE_ENV === 'production' ? 'json' : 'dev',
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.confirmPassword']
  },
  
  monitoring: {
    enableMetrics: envVars.ENABLE_METRICS,
    metricsRoute: envVars.METRICS_ROUTE,
    sentryDsn: envVars.SENTRY_DSN,
    newRelicKey: envVars.NEW_RELIC_LICENSE_KEY
  }
};

// Freeze the config object
Object.freeze(config);

module.exports = config;
