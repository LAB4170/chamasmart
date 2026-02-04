const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Sensitive fields to exclude from logging
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'token',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'api_key',
  'apiKey',
  'refreshToken',
  'accessToken',
  'creditCard',
  'cvv',
  'ssn',
];

/**
 * Deeply sanitize an object by redacting sensitive fields
 */
const deepSanitize = (obj, path = '') => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepSanitize(item, path));

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;
    
    // Check if this is a sensitive field
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      currentPath.toLowerCase().includes(field.toLowerCase())
    );

    if (isSensitive) {
      return { ...acc, [key]: '[REDACTED]' };
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object') {
      return { ...acc, [key]: deepSanitize(value, currentPath) };
    }

    return { ...acc, [key]: value };
  }, {});
};

// Sanitize request body
const sanitizeBody = body => deepSanitize(body);

// Sanitize headers
const sanitizeHeaders = headers => {
  if (!headers || typeof headers !== 'object') return headers;

  const sanitized = { ...headers };

  // Handle authorization header specially
  if (sanitized.authorization) {
    const parts = sanitized.authorization.split(' ');
    if (parts.length === 2) {
      sanitized.authorization = `${parts[0]} [REDACTED]`;
    } else {
      sanitized.authorization = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Request logger middleware
 * Logs incoming requests and outgoing responses with detailed information
 */
const requestLogger = (req, res, next) => {
  const startTime = process.hrtime();
  const requestId = req.id || (req.id = crypto.randomUUID());
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request details
  const requestLog = {
  remoteAddr: ":remote-addr",
});

// Create Morgan middleware
const requestLogger = morgan(
  process.env.NODE_ENV === "production" ? productionFormat : developmentFormat,
  {
    stream: logger.stream,
    skip: (req) =>
      // Skip health check and metrics endpoints to reduce noise
      req.url === "/api/health" || req.url === "/metrics",
  },
);

// Detailed request logger middleware (only in development or when debugging)
const detailedRequestLogger = (req, res, next) => {
  // Only log in development or when DEBUG flag is set
  if (process.env.NODE_ENV === "production" && !process.env.DEBUG) {
    return next();
  }

  const startTime = Date.now();

  // Log request
  logger.debug("Incoming request", {
    method: req.method,
    url: req.url,
    headers: sanitizeHeaders(req.headers),
    body: sanitizeBody(req.body),
    query: req.query,
    params: req.params,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logger.debug("Outgoing response", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      // Don't log response body in production
      ...(process.env.NODE_ENV !== "production" && {
        responseBody:
          typeof data === "string" ? data.substring(0, 500) : "[Binary Data]",
      }),
    });

    originalSend.call(this, data);
  };

  next();
};

module.exports = {
  requestLogger,
  detailedRequestLogger,
  sanitizeBody,
  sanitizeHeaders,
};
