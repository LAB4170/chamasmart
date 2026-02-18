/**
 * Retry utility with exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {string} errorMessage - Error message prefix
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<any>} - Result of the function call
 */
const executeWithRetry = async (
  fn,
  errorMessage = 'Operation failed',
  maxRetries = 3,
  initialDelay = 1000,
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      const delay = initialDelay * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const error = new Error(
    `${errorMessage} after ${maxRetries} retries: ${lastError.message}`,
  );
  error.originalError = lastError;
  error.retryCount = maxRetries;
  throw error;
};

/**
 * Exponential backoff helper
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
const exponentialBackoff = (attempt, baseDelay = 1000) => Math.min(baseDelay * 2 ** attempt, 30000) // Cap at 30 seconds
;

module.exports = {
  executeWithRetry,
  exponentialBackoff,
};
