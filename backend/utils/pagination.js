/**
 * Pagination Utility for handling page-based pagination
 * Ensures consistent pagination across all list endpoints
 */

/**
 * Parse pagination parameters from query string
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} - { page, limit, offset }
 */
const parsePagination = (page = 1, limit = 20) => {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (validPage - 1) * validLimit;

  return {
    page: validPage,
    limit: validLimit,
    offset,
  };
};

/**
 * Build LIMIT and OFFSET clause for SQL queries
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {string} - SQL LIMIT clause with placeholder
 */
const buildLimitClause = (page = 1, limit = 20) => {
  const { offset, limit: validLimit } = parsePagination(page, limit);
  return `LIMIT ${validLimit} OFFSET ${offset}`;
};

/**
 * Format paginated response
 * @param {Array} rows - Data rows
 * @param {number} total - Total count of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} - Formatted pagination metadata
 */
const formatPaginationMeta = (rows, total, page, limit) => {
  const { page: validPage, limit: validLimit } = parsePagination(page, limit);
  const totalPages = Math.ceil(total / validLimit);

  return {
    data: rows,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      totalPages,
      hasNextPage: validPage < totalPages,
      hasPreviousPage: validPage > 1,
      startIndex: (validPage - 1) * validLimit + 1,
      endIndex: Math.min(validPage * validLimit, total),
    },
  };
};

/**
 * Get total count from a table or a custom query
 * @param {Pool} pool - Database connection pool
 * @param {string} tableOrQuery - Table name or full SELECT query
 * @param {string|Array} whereClauseOrParams - WHERE clause if passing table, or Params if passing query
 * @param {Array|string} paramsOrAlias - Query parameters if passing table, or Alias if passing query
 * @returns {Promise<number>} - Total count
 */
const getTotal = async (pool, tableOrQuery, whereClauseOrParams = '', paramsOrAlias = []) => {
  let query;
  let queryParams;
  let alias = 'count';

  if (tableOrQuery.trim().toUpperCase().startsWith('SELECT')) {
    // It's a full query
    query = tableOrQuery;
    queryParams = Array.isArray(whereClauseOrParams) ? whereClauseOrParams : [];
    alias = typeof paramsOrAlias === 'string' ? paramsOrAlias : 'count';
  } else {
    // It's a table name
    query = whereClauseOrParams
      ? `SELECT COUNT(*) as count FROM ${tableOrQuery} WHERE ${whereClauseOrParams}`
      : `SELECT COUNT(*) as count FROM ${tableOrQuery}`;
    queryParams = Array.isArray(paramsOrAlias) ? paramsOrAlias : [];
  }

  const result = await pool.query(query, queryParams);
  return parseInt(result.rows[0][alias] || result.rows[0].count || 0);
};

module.exports = {
  parsePagination,
  buildLimitClause,
  formatPaginationMeta,
  getTotal,
};
