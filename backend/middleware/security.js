const helmet = require('helmet');
const hpp = require('hpp');
const logger = require('../utils/logger');
const { 
  apiLimiter, 
  loginLimiter,
  checkLoginRateLimit,
  checkOtpRateLimit,
  checkPasswordResetRateLimit
} = require('../security/enhancedRateLimiting');

/**
 * Helmet Configuration
 * Optimized for Firebase, Google Fonts, and WebSockets
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: [
        "'self'",
        'https://*.googleapis.com',
        'https://*.firebaseio.com',
        'https://*.firebase.com',
        'wss://*.firebaseio.com',
        'ws://localhost:*',
        'wss://localhost:*',
      ],
      frameSrc: ["'self'", 'https://*.firebaseapp.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Enhanced Input Validation Middleware
 * Sanitizes and checks for suspicious patterns (XSS/SQLi)
 */
const inputValidation = (req, res, next) => {
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\(/gi,
    /expression\(/gi,
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|SCRIPT)\b)/gi,
  ];

  const checkValue = value => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };

  const checkObject = obj => {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) return true;
      } else if (checkValue(obj[key])) {
        return true;
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    logger.warn('Suspicious input blocked', {
      ip: req.ip,
      path: req.path,
      userId: req.user?.user_id,
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid request content detected',
    });
  }

  next();
};

/**
 * Custom Security Headers
 */
const securityHeaders = (req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  next();
};

/**
 * Request size limiting (10MB)
 */
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024;
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({ success: false, message: 'Payload too large' });
  }
  next();
};

/**
 * Account-based Login Rate Limiter (Email + IP)
 */
const accountLoginLimiter = async (req, res, next) => {
  if (process.env.NODE_ENV === "test") return next();
  try {
    const identifier = req.body.email || req.ip;
    const isLimited = await checkLoginRateLimit(identifier, req.ip);
    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please try again in 15 minutes.",
      });
    }
    next();
  } catch (err) {
    logger.error("Account rate limit check failed", { error: err.message });
    next();
  }
};

/**
 * OTP Rate Limiter
 */
const otpLimiter = async (req, res, next) => {
  if (process.env.NODE_ENV === "test") return next();
  try {
    const isLimited = await checkOtpRateLimit(req.user?.user_id, req.ip);
    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP attempts. Please try again later.",
      });
    }
    next();
  } catch (err) {
    next();
  }
};

/**
 * Comprehensive Security Middleware Wrapper
 * Standardizes security for all routes
 */
const securityMiddleware = app => {
  // Trust proxy for correct IP detection behind load balancers/Heroku
  app.set("trust proxy", 1);

  // Apply critical headers
  app.use(helmetConfig);
  app.use(securityHeaders);

  // Apply input protections
  app.use(inputValidation);
  app.use(hpp());
  app.use(requestSizeLimiter);

  // Apply global rate limiting (100 req / 15 min)
  app.use('/api', apiLimiter);

  // Apply stricter auth rate limiting
  app.use(['/api/auth/login', '/api/auth/register'], loginLimiter);
  app.use('/api/auth/login', accountLoginLimiter);
  app.use(['/api/auth/verify-phone', '/api/auth/verify-email'], otpLimiter);
};

module.exports = {
  securityMiddleware,
  helmetConfig,
  inputValidation,
  securityHeaders,
  requestSizeLimiter,
};
