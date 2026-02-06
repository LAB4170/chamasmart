const logger = require("../utils/logger");

/**
 * Advanced CORS Configuration with:
 * - Wildcard subdomain support
 * - Rate-limited security logging
 * - Dynamic origin validation
 * - Configurable per environment
 */

// Rate limiter for security event logging
class SecurityEventRateLimiter {
  constructor(maxEvents = 10, windowMs = 60000) {
    this.events = new Map();
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
  }

  shouldLog(key) {
    const now = Date.now();
    const eventKey = `cors_violation_${key}`;

    if (!this.events.has(eventKey)) {
      this.events.set(eventKey, { count: 1, firstSeen: now });
      return true;
    }

    const event = this.events.get(eventKey);

    // Reset if window has passed
    if (now - event.firstSeen > this.windowMs) {
      this.events.set(eventKey, { count: 1, firstSeen: now });
      return true;
    }

    // Increment counter
    event.count++;

    // Only log if under threshold
    if (event.count <= this.maxEvents) {
      return true;
    }

    // Log summary at threshold
    if (event.count === this.maxEvents + 1) {
      logger.warn("CORS violation rate limit reached", {
        origin: key,
        count: event.count,
        windowMs: this.windowMs,
      });
    }

    return false;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, event] of this.events.entries()) {
      if (now - event.firstSeen > this.windowMs) {
        this.events.delete(key);
      }
    }
  }
}

const securityRateLimiter = new SecurityEventRateLimiter();

// Store interval for cleanup
const cleanupIntervals = [];

// Initialize CORS configuration
function initCors() {
  // Define allowed origins
  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : []),
    "http://localhost:3000", // Default development origin
  ];

  // Cleanup old rate limit entries every minute
  const cleanupInterval = setInterval(
    () => securityRateLimiter.cleanup(),
    60000,
  );
  cleanupIntervals.push(cleanupInterval);

  logger.info("CORS configured", {
    allowedOrigins: allowedOrigins,
    isProduction: process.env.NODE_ENV === "production",
  });

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn("CORS: Blocked request from origin", { origin });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Total-Count"],
  };

  const socketCorsOptions = {
    ...corsOptions,
    // Additional socket.io specific CORS options if needed
  };

  return {
    corsOptions,
    socketCorsOptions,
    allowedOrigins,
    cleanup: () => {
      cleanupIntervals.forEach(clearInterval);
      cleanupIntervals.length = 0;
    },
  };
}

const corsManager = initCors();

/**
 * Parse and validate allowed origins from environment
 */
const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS;

  if (envOrigins) {
    const origins = envOrigins.split(",").map((origin) => origin.trim());

    // Validate origins
    const validOrigins = origins.filter((origin) => {
      // Allow wildcards
      if (origin.includes("*")) return true;

      // Validate URL format
      try {
        new URL(origin);
        return true;
      } catch (e) {
        logger.warn("Invalid origin in ALLOWED_ORIGINS", { origin });
        return false;
      }
    });

    if (validOrigins.length !== origins.length) {
      logger.warn("Some origins were invalid and removed", {
        total: origins.length,
        valid: validOrigins.length,
      });
    }

    return validOrigins;
  }

  // Development defaults
  if (process.env.NODE_ENV !== "production") {
    logger.info("Using default development CORS origins");
    return [
      "http://localhost:5173",
      "http://localhost:5000",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5000",
      "http://127.0.0.1:3000",
    ];
  }

  // Production must have ALLOWED_ORIGINS
  logger.error("ALLOWED_ORIGINS not set in production - CORS will fail");

  // Return empty array to force explicit configuration
  return [];
};

/**
 * Check if origin matches allowed pattern
 * Supports:
 * - Exact match: https://example.com
 * - Wildcard subdomain: https://*.example.com
 * - Full wildcard: * (not recommended for production)
 */
const isOriginAllowed = (origin, allowedOrigins) => {
  if (!origin) return false;

  for (const allowed of allowedOrigins) {
    // Exact match
    if (allowed === origin) {
      return true;
    }

    // Full wildcard (not allowed in production)
    if (allowed === "*") {
      if (process.env.NODE_ENV === "production") {
        logger.error("Wildcard CORS origin not allowed in production", {
          origin,
        });
        return false;
      }
      logger.warn("Wildcard CORS origin allowed in development", { origin });
      return true;
    }

    // Wildcard subdomain matching
    if (allowed.includes("*")) {
      const pattern = allowed
        .replace(/\./g, "\\.") // Escape dots
        .replace(/\*/g, "[a-zA-Z0-9-]+"); // Replace * with subdomain pattern

      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) {
        return true;
      }
    }
  }

  return false;
};

const allowedOrigins = getAllowedOrigins();

// Log configured origins on startup
logger.info("CORS configured", {
  environment: process.env.NODE_ENV,
  originsCount: allowedOrigins.length,
  origins:
    allowedOrigins.length <= 10
      ? allowedOrigins
      : `${allowedOrigins.slice(0, 10).join(", ")}... (${allowedOrigins.length} total)`,
});

/**
 * Express CORS configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    // But log in production for monitoring
    if (!origin) {
      if (
        process.env.NODE_ENV === "production" &&
        process.env.LOG_NO_ORIGIN === "true"
      ) {
        logger.debug("Request with no origin header");
      }
      return callback(null, true);
    }

    // Check if origin is allowed
    const allowed = allowedOrigins.find(o => isOriginAllowed(origin, o));
    if (allowed) {
      // Use the actual allowed origin from our list if it doesn't contain wildcards
      // Otherwise use the reflected origin but we've already validated it
      const originToReturn = allowed.includes('*') ? origin : allowed;
      callback(null, originToReturn);
    } else {
      // Rate-limited security logging
      if (securityRateLimiter.shouldLog(origin)) {
        logger.logSecurityEvent("CORS_VIOLATION", {
          origin,
          allowedOriginsCount: allowedOrigins.length,
          timestamp: new Date().toISOString(),
        });
      }

      // Return error
      const error = new Error("Not allowed by CORS");
      error.statusCode = 403;
      callback(error);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Request-ID",
    "X-API-Key",
  ],
  exposedHeaders: [
    "X-Request-ID",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],
  maxAge: 86400, // 24 hours - browsers cache preflight
  optionsSuccessStatus: 204, // Some legacy browsers choke on 204
};

/**
 * Socket.io CORS configuration
 */
const socketCorsOptions = {
  origin: (origin, callback) => {
    // WebSocket connections should have origin
    if (!origin) {
      if (process.env.NODE_ENV === "production") {
        logger.warn("WebSocket connection with no origin");
        return callback(new Error("Origin required for WebSocket"));
      }
      return callback(null, true);
    }

    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      if (securityRateLimiter.shouldLog(origin)) {
        logger.logSecurityEvent("SOCKET_CORS_VIOLATION", {
          origin,
          allowedOriginsCount: allowedOrigins.length,
          timestamp: new Date().toISOString(),
        });
      }

      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST"],
};

/**
 * Dynamic origin addition (for admin/testing purposes)
 * Not recommended for production
 */
const addAllowedOrigin = (origin) => {
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
    logger.info("Added new allowed origin", { origin });
    return true;
  }
  return false;
};

/**
 * Remove origin from allowed list
 */
const removeAllowedOrigin = (origin) => {
  const index = allowedOrigins.indexOf(origin);
  if (index > -1) {
    allowedOrigins.splice(index, 1);
    logger.info("Removed allowed origin", { origin });
    return true;
  }
  return false;
};

/**
 * Get current CORS configuration status
 */
const getCorsStatus = () => ({
  environment: process.env.NODE_ENV,
  allowedOrigins,
  credentialsEnabled: corsOptions.credentials,
  maxAge: corsOptions.maxAge,
  methods: corsOptions.methods,
  allowedHeaders: corsOptions.allowedHeaders,
  exposedHeaders: corsOptions.exposedHeaders,
});

/**
 * Middleware to add CORS headers manually (if needed)
 */
const addCorsHeaders = (req, res, next) => {
  const { origin } = req.headers;

  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, X-Request-ID",
    );
    res.setHeader("Access-Control-Expose-Headers", "X-Request-ID");
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  next();
};

// Cleanup function to be called on shutdown
function cleanupCors() {
  if (corsManager && typeof corsManager.cleanup === "function") {
    corsManager.cleanup();
  }
}

// Handle process termination
process.on("SIGTERM", cleanupCors);
process.on("SIGINT", cleanupCors);

module.exports = {
  corsOptions,
  socketCorsOptions,
  allowedOrigins,
  cleanup: cleanupCors,
  isOriginAllowed,
  addAllowedOrigin,
  removeAllowedOrigin,
  getCorsStatus,
  addCorsHeaders,
};
