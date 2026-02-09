/**
 * Standard Response Formatter for all API endpoints
 * Ensures consistent response format across the entire application
 *
 * Usage:
 * res.json(success(data, "Resource created", 201))
 * res.json(error("Something went wrong"))
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Generate request ID for tracing
 */
const generateRequestId = () => uuidv4().split('-')[0];

/**
 * Success Response Format
 * @param {*} data - Response data
 * @param {string} message - User-friendly message
 * @param {number} statusCode - HTTP status code (optional, default 200)
 * @param {string} requestId - Request ID for tracing (auto-generated if not provided)
 */
const success = (
  data = null,
  message = 'Success',
  statusCode = 200,
  requestId = null,
) => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
  requestId: requestId || generateRequestId(),
  statusCode,
});

/**
 * Error Response Format
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (optional, default 400)
 * @param {*} details - Additional error details for debugging (optional)
 * @param {string} requestId - Request ID for tracing (auto-generated if not provided)
 */
const error = (
  message = 'An error occurred',
  statusCode = 400,
  details = null,
  requestId = null,
) => ({
  success: false,
  message,
  data: null,
  timestamp: new Date().toISOString(),
  requestId: requestId || generateRequestId(),
  statusCode,
  ...(details && { details }), // Include details only if provided
});

/**
 * Validation Error Response Format
 * @param {*} errors - Validation errors (can be raw Joi errors or pre-formatted)
 * @param {string} requestId - Request ID for tracing
 */
const validationError = (errors, requestId = null) => {
  let formattedErrors;

  if (Array.isArray(errors)) {
    // Check if errors are already formatted (have 'field' property)
    if (errors.length > 0 && errors[0].field !== undefined) {
      // Already formatted by queryValidation.js
      formattedErrors = errors;
    } else if (errors.length > 0 && errors[0].path !== undefined) {
      // Raw Joi errors - need formatting
      formattedErrors = errors.map(err => ({
        field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown'),
        message: err.message,
        type: err.type,
      }));
    } else {
      // Unknown format - pass through
      formattedErrors = errors;
    }
  } else {
    // Not an array - pass through as-is
    formattedErrors = errors;
  }

  return {
    success: false,
    message: 'Validation failed',
    data: null,
    errors: formattedErrors,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    statusCode: 422,
  };
};

/**
 * Paginated Response Format
 * @param {*} data - Array of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total count of items
 * @param {string} message - User-friendly message
 * @param {string} requestId - Request ID for tracing
 */
const paginated = (
  data = [],
  page = 1,
  limit = 20,
  total = 0,
  message = 'Success',
  requestId = null,
) => {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    statusCode: 200,
  };
};

/**
 * Middleware to attach response methods to res object
 */
const responseFormatterMiddleware = (req, res, next) => {
  // Generate request ID and attach to request
  req.id = generateRequestId();

  // Attach response helper methods
  res.success = (data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json(success(data, message, statusCode, req.id));
  };

  res.error = (
    message = 'An error occurred',
    statusCode = 400,
    details = null,
  ) => {
    res.status(statusCode).json(error(message, statusCode, details, req.id));
  };

  res.validationError = errors => {
    res.status(422).json(validationError(errors, req.id));
  };

  res.paginated = (data, page, limit, total, message = 'Success') => {
    res.status(200).json(paginated(data, page, limit, total, message, req.id));
  };

  next();
};

module.exports = {
  success,
  error,
  validationError,
  paginated,
  responseFormatterMiddleware,
  generateRequestId,
};
