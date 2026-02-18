const logger = require("../utils/logger");
const crypto = require("crypto");

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
  "refreshToken",
  "accessToken",
  "creditCard",
  "cvv",
  "ssn",
];

/**
 * Deeply sanitize an object by redacting sensitive fields
 */
const deepSanitize = (obj, path = "") => {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepSanitize(item, path));

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if this is a sensitive field
    const isSensitive = SENSITIVE_FIELDS.some((field) =>
      currentPath.toLowerCase().includes(field.toLowerCase()),
    );

    if (isSensitive) {
      return { ...acc, [key]: "[REDACTED]" };
    }

    // Recursively sanitize nested objects
    if (value && typeof value === "object") {
      return { ...acc, [key]: deepSanitize(value, currentPath) };
    }

    return { ...acc, [key]: value };
  }, {});
};

// Sanitize request body
const sanitizeBody = (body) => deepSanitize(body);

// Sanitize headers
const sanitizeHeaders = (headers) => {
  if (!headers || typeof headers !== "object") return headers;

  const sanitized = { ...headers };

  // Handle authorization header specially
  if (sanitized.authorization) {
    const parts = sanitized.authorization.split(" ");
    if (parts.length === 2) {
      sanitized.authorization = `${parts[0]} [REDACTED]`;
    } else {
      sanitized.authorization = "[REDACTED]";
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
  res.setHeader("X-Request-ID", requestId);

  // Log request details
  const requestLog = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
    userId: req.user?.id || "anonymous",
    requestId,
    headers: sanitizeHeaders(req.headers),
    query: req.query,
    params: req.params,
  };

  // Only log body for non-GET requests and if there is a body
  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    requestLog.body = sanitizeBody(req.body);
  }

  logger.http("Request received", requestLog);

  // Capture response data
  const originalSend = res.send;
  const chunks = [];

  res.send = function (body, ...args) {
    chunks.push(Buffer.from(body));
    return originalSend.apply(res, [body, ...args]);
  };

  // Log response when finished
  res.on("finish", () => {
    const durationInMs = process.hrtime(startTime)[1] / 1000000; // Convert to ms
    const responseLog = {
      statusCode: res.statusCode,
      duration: `${durationInMs.toFixed(2)}ms`,
      requestId,
      contentLength: res.get("content-length") || 0,
      contentType: res.get("content-type"),
    };

    // Log response body for errors or when in development
    if (process.env.NODE_ENV === "development" || res.statusCode >= 400) {
      try {
        const responseBody = Buffer.concat(chunks).toString("utf8");
        if (responseBody) {
          responseLog.response = JSON.parse(responseBody);
        }
      } catch (e) {
        // If not JSON, log as text
        responseLog.response = "Non-JSON response";
      }
    }

    // Log at appropriate level based on status code
    if (res.statusCode >= 500) {
      logger.error("Request error", responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn("Request warning", responseLog);
    } else if (process.env.LOG_LEVEL === "debug") {
      logger.debug("Request completed", responseLog);
    } else {
      logger.http("Request completed", responseLog);
    }
  });

  next();
};

/**
 * Detailed request logger for development
 * Provides more verbose logging of requests and responses
 */
const detailedRequestLogger = (req, res, next) => {
  // Only log in development or when DEBUG is enabled
  if (process.env.NODE_ENV !== "development" && !process.env.DEBUG) {
    return next();
  }

  logger.debug("=== Request Details ===");
  logger.debug(`Method: ${req.method}`);
  logger.debug(`URL: ${req.originalUrl}`);
  logger.debug("Headers:", sanitizeHeaders(req.headers));
  logger.debug("Query:", req.query);
  logger.debug("Params:", req.params);

  if (req.body && Object.keys(req.body).length > 0) {
    logger.debug("Body:", sanitizeBody(req.body));
  }

  const startTime = process.hrtime();
  const originalEnd = res.end;

  res.end = function (chunk, encoding) {
    const durationInMs = process.hrtime(startTime)[1] / 1000000;

    logger.debug("=== Response Details ===");
    logger.debug(`Status: ${res.statusCode}`);
    logger.debug(`Duration: ${durationInMs.toFixed(2)}ms`);

    if (chunk) {
      try {
        const response = JSON.parse(chunk.toString());
        logger.debug("Response:", deepSanitize(response));
      } catch (e) {
        logger.debug(
          "Response (non-JSON):",
          chunk.toString().substring(0, 500),
        );
      }
    }

    originalEnd.call(res, chunk, encoding);
  };

  next();
};

module.exports = {
  requestLogger,
  detailedRequestLogger,
  sanitizeBody,
  sanitizeHeaders,
  deepSanitize,
};
