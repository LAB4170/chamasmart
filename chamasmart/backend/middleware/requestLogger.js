const morgan = require("morgan");
const logger = require("../utils/logger");

// Sensitive fields to exclude from logging
const SENSITIVE_FIELDS = [
  "password",
  "password_hash",
  "token",
  "authorization",
  "cookie",
  "jwt",
  "secret",
  "api_key",
  "apiKey",
];

// Sanitize request body
const sanitizeBody = (body) => {
  if (!body || typeof body !== "object") return body;

  const sanitized = { ...body };

  for (const field of SENSITIVE_FIELDS) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
};

// Sanitize headers
const sanitizeHeaders = (headers) => {
  if (!headers || typeof headers !== "object") return headers;

  const sanitized = { ...headers };

  // Redact all sensitive fields except authorization which we handle specially
  for (const field of SENSITIVE_FIELDS) {
    if (field !== "authorization" && sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  // Partially redact authorization header (handle specially)
  if (sanitized.authorization) {
    const parts = sanitized.authorization.split(" ");
    if (parts.length === 2) {
      sanitized.authorization = `${parts[0]} ${parts[1].substring(0, 10)}...`;
    } else {
      sanitized.authorization = "[REDACTED]";
    }
  }

  return sanitized;
};

// Custom Morgan token for sanitized body
morgan.token("sanitized-body", (req) => {
  if (!req.body || Object.keys(req.body).length === 0) return "";
  return JSON.stringify(sanitizeBody(req.body));
});

// Custom Morgan token for user ID
morgan.token("user-id", (req) => {
  return req.user?.user_id || "anonymous";
});

// Custom Morgan token for request ID (if using request ID middleware)
morgan.token("request-id", (req) => {
  return req.id || "-";
});

// Development format - more verbose
const developmentFormat =
  ":method :url :status :response-time ms - :user-id - :sanitized-body";

// Production format - structured
const productionFormat = JSON.stringify({
  method: ":method",
  url: ":url",
  status: ":status",
  responseTime: ":response-time",
  userId: ":user-id",
  requestId: ":request-id",
  userAgent: ":user-agent",
  remoteAddr: ":remote-addr",
});

// Create Morgan middleware
const requestLogger = morgan(
  process.env.NODE_ENV === "production" ? productionFormat : developmentFormat,
  {
    stream: logger.stream,
    skip: (req) => {
      // Skip health check and metrics endpoints to reduce noise
      return req.url === "/api/health" || req.url === "/metrics";
    },
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
