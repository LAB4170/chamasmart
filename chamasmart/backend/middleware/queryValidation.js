/**
 * Query Parameter Validation Middleware
 * Validates common query parameters used across endpoints
 */

const Joi = require("joi");
const logger = require("../utils/logger");

/**
 * Common query parameter validation schema
 */
const querySchema = Joi.object({
  // Pagination
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),

  // Sorting
  sortBy: Joi.string().min(1).max(50),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),

  // Search
  search: Joi.string().min(1).max(200),
  query: Joi.string().min(1).max(200),

  // Filtering
  status: Joi.string().max(50),
  type: Joi.string().max(50),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),

  // Debugging
  debug: Joi.boolean(),
}).unknown(true); // Allow unknown fields but validate known ones

/**
 * Validate query parameters middleware
 */
const validateQueryParams = (req, res, next) => {
  const { error, value } = querySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    logger.warn("Invalid query parameters", {
      path: req.path,
      query: req.query,
      errors: details,
    });

    return res.validationError(details);
  }

  // Replace query with validated values
  req.query = value;

  // Log search queries for debugging
  if (req.query.search || req.query.query) {
    logger.info("Search query", {
      path: req.path,
      searchTerm: req.query.search || req.query.query,
    });
  }

  next();
};

/**
 * Sanitize search terms to prevent injection
 */
const sanitizeSearchTerm = (searchTerm) => {
  if (!searchTerm) return "";

  // Remove special characters that could cause issues
  return searchTerm
    .replace(/[%_\\]/g, "\\$&") // Escape LIKE wildcards
    .trim()
    .substring(0, 200); // Max 200 chars
};

/**
 * Build safe LIKE clause for database queries
 */
const buildLikeClause = (field, searchTerm, caseInsensitive = true) => {
  const sanitized = sanitizeSearchTerm(searchTerm);
  const likeOp = caseInsensitive ? "ILIKE" : "LIKE";
  return {
    clause: `${field} ${likeOp} $1`,
    value: `%${sanitized}%`,
  };
};

/**
 * Validate sort parameters
 */
const validateSortParams = (allowedFields, req) => {
  const { sortBy, sortOrder } = req.query;

  if (!sortBy) {
    return null; // No sort specified
  }

  // Whitelist allowed sort fields to prevent SQL injection
  if (!allowedFields.includes(sortBy)) {
    logger.warn("Invalid sort field attempted", {
      attempted: sortBy,
      allowed: allowedFields,
    });
    return null;
  }

  const order = (sortOrder || "desc").toUpperCase();
  if (!["ASC", "DESC"].includes(order)) {
    return null;
  }

  return { sortBy, order };
};

module.exports = {
  validateQueryParams,
  sanitizeSearchTerm,
  buildLikeClause,
  validateSortParams,
};
