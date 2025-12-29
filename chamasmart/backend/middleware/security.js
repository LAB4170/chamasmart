const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const logger = require('../utils/logger');

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
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", 'ws:', 'wss:'],
        },
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    },
    frameguard: {
        action: 'deny', // Prevent clickjacking
    },
    noSniff: true, // Prevent MIME type sniffing
    xssFilter: true, // Enable XSS filter
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
});

/**
 * NoSQL Injection Protection
 * Sanitizes user input to prevent NoSQL injection attacks
 */
const noSqlInjectionProtection = mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        logger.warn('Potential NoSQL injection attempt detected', {
            ip: req.ip,
            path: req.path,
            key,
            userId: req.user?.user_id,
        });
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
    whitelist: ['sort', 'filter', 'page', 'limit'], // Allow these params to be duplicated
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
        if (typeof value === 'string') {
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
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (checkObject(obj[key])) return true;
            } else if (checkValue(obj[key])) {
                return true;
            }
        }
        return false;
    };

    // Check body, query, and params
    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
        logger.warn('Suspicious input detected', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userId: req.user?.user_id,
        });

        return res.status(400).json({
            success: false,
            message: 'Invalid input detected',
        });
    }

    next();
};

/**
 * Security Headers Middleware
 * Adds custom security headers
 */
const securityHeaders = (req, res, next) => {
    // Remove powered by header
    res.removeHeader('X-Powered-By');

    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
};

/**
 * Request Size Limiter
 * Prevents large payload attacks
 */
const requestSizeLimiter = (req, res, next) => {
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
        logger.warn('Request size exceeded limit', {
            ip: req.ip,
            path: req.path,
            size: req.headers['content-length'],
        });

        return res.status(413).json({
            success: false,
            message: 'Request entity too large',
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
            logger.warn('Blocked IP attempted access', {
                ip: clientIp,
                path: req.path,
            });

            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        // Check whitelist (if configured)
        if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
            logger.warn('Non-whitelisted IP attempted access', {
                ip: clientIp,
                path: req.path,
            });

            return res.status(403).json({
                success: false,
                message: 'Access denied',
            });
        }

        next();
    };
};

module.exports = {
    helmetConfig,
    noSqlInjectionProtection,
    xssProtection,
    hppProtection,
    inputValidation,
    securityHeaders,
    requestSizeLimiter,
    ipFilter,
};
