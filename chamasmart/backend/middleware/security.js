const helmet = require("helmet");
const xss = require("xss-clean");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const logger = require("../utils/logger");

// Initialize Redis client for distributed rate limiting
// Fail gracefully if REDIS is not available
let redisClient;
try {
  redisClient = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1, // Fail fast if Redis is down
    })
    : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT || 6379,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        // If Redis is down, we don't want to block the app forever
        if (times > 3) {
          logger.warn(
            "Redis connection failed multiple times. Disabling distributed rate limiting."
          );
          return null;
        }
        return Math.min(times * 50, 2000);
      },
    });

  redisClient.on("error", (err) => {
    // Suppress connection errors to avoid log spam if Redis is intentionally missing
    if (err.code === "ECONNREFUSED") {
      // logger.debug('Redis connection refused');
    } else {
      logger.error("Redis Rate Limiter Error:", err.message);
    }
  });
} catch (error) {
  logger.warn("Failed to initialize Redis client:", error.message);
}

// Rate limiting configuration (Memory-based fallback)
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later",
  skip: (req) => {
    const path = req.path || '';
    return (
      path === "/health" ||
      path === "/api/ping" ||
      path.startsWith("/static/") ||
      path.endsWith(".js") ||
      path.endsWith(".css")
    );
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many login attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Redis-based rate limiter for API endpoints (if Redis is available)
let apiRateLimiter;
if (redisClient) {
  try {
    apiRateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "api_limit",
      points: 100, // 100 requests
      duration: 60, // per 1 minute by IP
      blockDuration: 60 * 15, // Block for 15 minutes after limit is reached
    });
  } catch (err) {
    logger.warn("Failed to initialize Redis rate limiter, falling back to memory:", err.message);
  }
}

// Apply rate limiting middleware
const apiLimiter = (req, res, next) => {
  const path = req.path || '';
  if (path.startsWith("/health") || path.startsWith("/metrics") || path === "/api/ping") {
    return next();
  }

  // CRITICAL FIX: Only use Redis limiter if both client AND limiter exist and Redis is ready
  const isRedisReady = redisClient && redisClient.status === 'ready';

  if (apiRateLimiter && isRedisReady) {
    apiRateLimiter
      .consume(req.ip)
      .then(() => next())
      .catch((err) => {
        // Only return 429 if it's actually a rate limit exceed (not a connection error)
        if (err && err.msBeforeNext) {
          res.status(429).json({
            success: false,
            message: "Too many requests, please try again later",
          });
        } else {
          // If it's a Redis error, fall back to next (memory limiter will handle it)
          next();
        }
      });
  } else {
    // Redis not ready - rely on the global memory-based rateLimiter
    next();
  }
};

/**
 * Advanced Security Middleware
 * Implements multiple layers of security protection
 */

/**
 * Helmet - Security headers
 * Protects against common web vulnerabilities
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: "deny", // Prevent clickjacking
  },
  noSniff: true, // Prevent MIME type sniffing
  xssFilter: true, // Enable XSS filter
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
});

/**
 * XSS Protection
 * Sanitizes user input to prevent cross-site scripting attacks
 */
const xssProtection = xss();

/**
 * HTTP Parameter Pollution Protection
 * Prevents parameter pollution attacks
 */
const hppProtection = hpp({
  whitelist: ["sort", "filter", "page", "limit"], // Allow these params to be duplicated
});

/**
 * Input Validation Middleware
 * Validates and sanitizes all user inputs
 */
const inputValidation = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /eval\(/gi, // Eval function
    /expression\(/gi, // CSS expressions
  ];

  const checkValue = (value) => {
    if (typeof value === "string") {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        if (checkObject(obj[key])) return true;
      } else if (checkValue(obj[key])) {
        return true;
      }
    }
    return false;
  };

  // Check body, query, and params
  if (
    checkObject(req.body) ||
    checkObject(req.query) ||
    checkObject(req.params)
  ) {
    logger.warn("Suspicious input detected", {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.user_id,
    });

    return res.status(400).json({
      success: false,
      message: "Invalid input detected",
    });
  }

  next();
};

/**
 * Security Headers Middleware
 * Adds custom security headers (redundant with Helmet but explicit for critical ones)
 */
const securityHeaders = (req, res, next) => {
  // Remove powered by header
  res.removeHeader("X-Powered-By");

  // Add custom security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  next();
};

/**
 * Request Size Limiter
 * Prevents large payload attacks
 */
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (
    req.headers["content-length"] &&
    parseInt(req.headers["content-length"]) > maxSize
  ) {
    logger.warn("Request size exceeded limit", {
      ip: req.ip,
      path: req.path,
      size: req.headers["content-length"],
    });

    return res.status(413).json({
      success: false,
      message: "Request entity too large",
    });
  }

  next();
};

/**
 * IP Whitelist/Blacklist Middleware
 * Allows/blocks specific IP addresses
 */
const ipFilter = (options = {}) => {
  const { whitelist = [], blacklist = [] } = options;

  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;

    // Check blacklist
    if (blacklist.length > 0 && blacklist.includes(clientIp)) {
      logger.warn("Blocked IP attempted access", {
        ip: clientIp,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check whitelist (if configured)
    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      logger.warn("Non-whitelisted IP attempted access", {
        ip: clientIp,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  };
};

// Security middleware wrapper
const securityMiddleware = (app) => {
  // Apply security headers
  app.use(helmetConfig);

  // Apply rate limiting
  app.use(rateLimiter);

  // Apply stricter rate limiting to auth endpoints
  app.use(
    ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"],
    authLimiter
  );

  // Apply Redis-based rate limiting to API routes
  app.use("/api", apiLimiter);

  // Apply other security middleware
  // app.use(noSqlInjectionProtection); // Removed: Not using MongoDB
  app.use(xssProtection);
  app.use(hpp());

  // Add security headers
  app.use(securityHeaders);

  // Request size limiting
  app.use(requestSizeLimiter);
};

module.exports = {
  helmetConfig,
  // noSqlInjectionProtection,
  xssProtection,
  securityMiddleware,
  rateLimiter,
  authLimiter,
  hppProtection,
  inputValidation,
  securityHeaders,
  requestSizeLimiter,
  ipFilter,
};
