/**
 * Cache Control Middleware
 * Adds intelligent HTTP caching headers based on endpoint type
 */

const crypto = require("crypto");
const logger = require("../utils/logger");

/**
 * Determine cache duration based on endpoint
 * @param {Object} req - Express request object
 * @returns {number} Cache duration in seconds (0 = no cache)
 */
const getCacheDuration = (req) => {
  // Don't cache non-GET requests
  if (req.method !== "GET") {
    return 0;
  }

  // Public endpoints (high cache)
  if (
    req.path.includes("/public") ||
    req.path.includes("/trending") ||
    req.path === "/api/ping"
  ) {
    return 3600; // 1 hour
  }

  // User-specific endpoints (low cache)
  if (
    req.path.includes("/my-") ||
    req.path.includes("/me") ||
    req.path.includes("/user/")
  ) {
    return 300; // 5 minutes
  }

  // List endpoints (low cache)
  if (
    req.path.match(/.*\/\d+$/i) || // Ends with ID (list endpoints)
    req.path.includes("/list") ||
    req.path.includes("/all")
  ) {
    return 300; // 5 minutes
  }

  // Default: no cache for mutations and dynamic content
  return 0;
};

/**
 * Generate ETag from response data
 * @param {*} data - Response data to hash
 * @returns {string} ETag hash
 */
const generateETag = (data) => {
  try {
    const json = typeof data === "string" ? data : JSON.stringify(data);
    const hash = crypto.createHash("md5").update(json).digest("hex");
    return `"${hash}"`;
  } catch (err) {
    logger.warn("Error generating ETag:", err.message);
    return `"${Date.now()}"`;
  }
};

/**
 * Cache Control Middleware
 */
const cacheControlMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    const duration = getCacheDuration(req);

    if (duration > 0 && res.statusCode === 200) {
      // Cache for successful GET requests
      res.set("Cache-Control", `public, max-age=${duration}`);
      res.set("ETag", generateETag(data));
    } else if (res.statusCode === 200) {
      // Allow user-specific caching for user endpoints
      if (req.path.includes("/me") || req.path.includes("/my-")) {
        res.set("Cache-Control", "private, max-age=300");
      } else {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    } else {
      // Don't cache error responses
      res.set("Cache-Control", "no-store, no-cache");
    }

    // Set Vary header for content negotiation
    res.set("Vary", "Accept, Authorization");

    // HTTP/1.0 compatibility
    res.set("Pragma", duration > 0 ? "public" : "no-cache");

    // Set Expires header for HTTP/1.0 clients
    if (duration > 0) {
      const expires = new Date(Date.now() + duration * 1000);
      res.set("Expires", expires.toUTCString());
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  cacheControlMiddleware,
  getCacheDuration,
  generateETag,
};
