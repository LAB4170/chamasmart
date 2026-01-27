/**
 * Enhanced Error Handler Middleware
 * Provides comprehensive error handling with proper logging and user feedback
 */

const logger = require('../utils/logger');
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require('../utils/auditLog');
const { HTTP_STATUS, ERROR_CODES } = require('./constants');

/**
 * Custom API Error Class
 */
class APIError extends Error {
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode = ERROR_CODES.INTERNAL_ERROR,
    errors = [],
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database Error Handler
 */
class DatabaseError extends APIError {
  constructor(message, originalError = null) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_ERROR);
    this.name = 'DatabaseError';
    this.originalError = originalError;

    // Log database errors with full context
    logger.error('Database Error:', {
      message,
      stack: originalError?.stack,
      query: originalError?.query,
      parameters: originalError?.parameters,
      severity: 'HIGH',
    });
  }
}

/**
 * Validation Error Handler
 */
class ValidationError extends APIError {
  constructor(errors, message = 'Validation failed') {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, errors);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication Error Handler
 */
class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTHENTICATION_ERROR);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error Handler
 */
class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.AUTHORIZATION_ERROR);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource Not Found Error Handler
 */
class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error Handler
 */
class ConflictError extends APIError {
  constructor(message = 'Resource conflict') {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
    this.name = 'ConflictError';
  }
}

/**
 * Rate Limit Error Handler
 */
class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMIT_EXCEEDED);
    this.name = 'RateLimitError';
  }
}

/**
 * Central Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  const error = { ...err };
  error.message = err.message;

  // Log error details
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Default error response
  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorCode = ERROR_CODES.INTERNAL_ERROR;
  let message = 'Internal server error';
  let errors = [];

  // Handle specific error types
  if (err instanceof APIError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    errors = err.errors;
  } else if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Validation failed';
    errors = err.details?.map(detail => ({
      field: detail.path?.join('.'),
      message: detail.message,
    }));
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = HTTP_STATUS.CONFLICT;
    errorCode = ERROR_CODES.CONFLICT;
    message = 'Resource already exists';
    errors = [{ field: 'unique', message: 'A record with this value already exists' }];
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Invalid reference';
    errors = [{ field: 'foreign_key', message: 'Referenced resource does not exist' }];
  } else if (err.code === '23502') { // PostgreSQL not null violation
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Required field missing';
    errors = [{ field: 'not_null', message: 'A required field is missing' }];
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
    message = 'Token expired';
  } else if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    errorCode = ERROR_CODES.VALIDATION_ERROR;
    message = 'Invalid data format';
  }

  // Log audit event for security-related errors
  if (statusCode >= 400) {
    logAuditEvent({
      eventType: statusCode === 401 ? EVENT_TYPES.AUTH_FAILED : EVENT_TYPES.SYSTEM_ERROR,
      userId: req.user?.id || null,
      action: `Error: ${message}`,
      entityType: 'system',
      entityId: null,
      metadata: {
        url: req.url,
        method: req.method,
        statusCode,
        errorCode,
        errors: errors.length > 0 ? errors : undefined,
      },
      severity: statusCode >= 500 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
    }).catch(auditError => {
      logger.error('Failed to log audit event:', auditError);
    });
  }

  // Send error response
  const errorResponse = {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
  };

  // Include errors in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.errors = errors;
    errorResponse.stack = err.stack;
  } else if (errors.length > 0) {
    // Include validation errors in production (they're safe to expose)
    errorResponse.errors = errors;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

/**
 * Async Error Wrapper
 * Wraps async functions to catch errors automatically
 */
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation Error Handler
 * Converts Joi validation errors to our format
 */
const validationErrorHandler = error => {
  if (error.details) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value,
    }));
    throw new ValidationError(errors);
  }
  throw error;
};

module.exports = {
  // Error classes
  APIError,
  DatabaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,

  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
};
