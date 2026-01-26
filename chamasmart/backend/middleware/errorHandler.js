/**
 * Centralized Error Handling
 * Standardized error responses across the application
 */

const logger = require("../utils/logger");
const { HTTP_STATUS, ERROR_CODES } = require("./constants");

/**
 * Custom API Error Class
 */
class APIError extends Error {
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODES.INTERNAL_ERROR,
    errors = [],
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Specific Error Classes
 */
class ValidationError extends APIError {
  constructor(message = "Validation failed", errors = []) {
    super(
      message,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      errors,
    );
  }
}

class AuthenticationError extends APIError {
  constructor(message = "Authentication failed") {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTHENTICATION_ERROR);
  }
}

class AuthorizationError extends APIError {
  constructor(message = "Access denied") {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.AUTHORIZATION_ERROR);
  }
}

class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }
}

class RateLimitError extends APIError {
  constructor(message = "Too many requests", retryAfter = 60) {
    super(
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
    );
    this.retryAfter = retryAfter;
  }
}

class FileUploadError extends APIError {
  constructor(message = "File upload failed") {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.FILE_UPLOAD_ERROR);
  }
}

class DatabaseError extends APIError {
  constructor(message = "Database operation failed") {
    super(
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.DATABASE_ERROR,
    );
  }
}

/**
 * Error Response Formatter
 */
const formatErrorResponse = (err, req) => {
  const isProduction = process.env.NODE_ENV === "production";

  const response = {
    success: false,
    error: {
      message: err.message,
      code: err.errorCode || ERROR_CODES.INTERNAL_ERROR,
    },
  };

  // Add validation errors if present
  if (err.errors && err.errors.length > 0) {
    response.error.details = err.errors;
  }

  // Add retry-after for rate limit errors
  if (err.retryAfter) {
    response.error.retryAfter = err.retryAfter;
  }

  // Add stack trace in development
  if (!isProduction && err.stack) {
    response.error.stack = err.stack;
  }

  // Add request context in development
  if (!isProduction) {
    response.error.context = {
      url: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    };
  }

  return response;
};

/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error details
  const errorLog = {
    message: err.message,
    code: err.errorCode,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId || req.user?.user_id,
    timestamp: new Date().toISOString(),
  };

  if (err.statusCode >= 500) {
    logger.error("Server error occurred", errorLog);
  } else if (err.statusCode >= 400) {
    logger.warn("Client error occurred", errorLog);
  } else {
    logger.info("Error occurred", errorLog);
  }

  // Don't expose internal errors in production
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = err.message;

  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "Internal server error";
  }

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = HTTP_STATUS.BAD_REQUEST;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = "Token expired";
  } else if (err.code === "23505") {
    // PostgreSQL unique violation
    statusCode = HTTP_STATUS.CONFLICT;
    message = "Resource already exists";
  } else if (err.code === "23503") {
    // PostgreSQL foreign key violation
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = "Invalid reference";
  }

  // Set status code on error object for response formatter
  err.statusCode = statusCode;
  err.message = message;

  // Format and send response
  const response = formatErrorResponse(err, req);
  res.status(statusCode).json(response);
};

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async Handler Wrapper
 * Eliminates need for try-catch in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation Error Helper
 */
const validationError = (res, errors) => {
  const formattedErrors = Array.isArray(errors)
    ? errors
    : [{ message: errors }];

  const error = new ValidationError("Validation failed", formattedErrors);

  return res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      code: error.errorCode,
      details: formattedErrors,
    },
  });
};

/**
 * Attach helper methods to response object
 */
const attachErrorHelpers = (req, res, next) => {
  res.validationError = (errors) => validationError(res, errors);

  res.authenticationError = (message) => {
    const error = new AuthenticationError(message);
    return res.status(error.statusCode).json(formatErrorResponse(error, req));
  };

  res.authorizationError = (message) => {
    const error = new AuthorizationError(message);
    return res.status(error.statusCode).json(formatErrorResponse(error, req));
  };

  res.notFoundError = (message) => {
    const error = new NotFoundError(message);
    return res.status(error.statusCode).json(formatErrorResponse(error, req));
  };

  next();
};

module.exports = {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  FileUploadError,
  DatabaseError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationError,
  attachErrorHelpers,
};
