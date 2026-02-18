/**
 * Data Protection Middleware
 * Implements KDPA 2019 compliance controls
 */

const AuditLogger = require('./auditLogger');
const logger = require('../utils/logger');

/**
 * Middleware to log all data access
 */
exports.dataAccessLoggingMiddleware = (req, res, next) => {
  // Capture original send
  const originalSend = res.send;

  res.send = function (data) {
    // Log successful reads
    if (req.method === 'GET' && res.statusCode === 200) {
      AuditLogger.logDataAccess(
        req.user?.user_id,
        'READ',
        extractResourceType(req.path),
        extractResourceId(req.path),
        {
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
          endpoint: req.path,
        },
      ).catch(err => logger.error('Failed to log data access:', err.message));
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to enforce HTTPS
 * CRITICAL: Redirect HTTP to HTTPS in production
 */
exports.enforceHttpsMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(307, `https://${req.get('host')}${req.originalUrl}`);
    }
  }
  next();
};

/**
 * Middleware to add security headers
 * CRITICAL: HSTS, Content-Security-Policy, etc
 */
exports.enhancedSecurityHeadersMiddleware = (req, res, next) => {
  // HSTS: Enforce HTTPS for 1 year
  res.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  );

  // Prevent clickjacking
  res.set('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.set('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (formerly Feature-Policy)
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP: Strict content security policy
  res.set(
    'Content-Security-Policy',
    'default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; font-src \'self\'; connect-src \'self\'',
  );

  next();
};

/**
 * Middleware to sanitize request payloads
 * Remove unnecessary sensitive fields from request/response
 */
exports.dataSanitizationMiddleware = (req, res, next) => {
  // Remove sensitive fields from logs
  if (req.body && req.body.password) {
    req.body.password = '[REDACTED]';
  }
  if (req.body && req.body.pin) {
    req.body.pin = '[REDACTED]';
  }

  next();
};

/**
 * Middleware to add GDPR/KDPA compliance headers
 */
exports.privacyHeadersMiddleware = (req, res, next) => {
  // Indicate data processing
  res.set('X-Content-Classification', 'CONFIDENTIAL');
  res.set('X-Data-Classification', 'SENSITIVE');

  next();
};

/**
 * Middleware to track all financial transactions
 */
exports.financialTransactionTracker = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    // Check if this is a financial transaction
    const isFinancialTransaction = [
      '/api/contributions/',
      '/api/loans/',
      '/api/payouts/',
      '/api/welfare/',
      '/api/rosca/',
    ].some(path => req.path.includes(path));

    if (
      isFinancialTransaction
      && ['POST', 'PUT', 'DELETE'].includes(req.method)
      && res.statusCode === 200
    ) {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;

        AuditLogger.logFinancialTransaction(
          req.user?.user_id,
          extractTransactionType(req.path, req.method),
          extractAmount(responseData) || 0,
          extractChamaId(req.path),
          {
            status: 'COMPLETED',
            endpoint: req.path,
            method: req.method,
            ip_address: req.ip,
          },
        ).catch(err => logger.error('Failed to log financial transaction:', err.message));
      } catch (error) {
        logger.error('Error tracking financial transaction:', error.message);
      }
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to enforce data minimization
 * (Only request necessary data)
 */
exports.dataMinimizationMiddleware = (req, res, next) => {
  // Validate that requested fields are necessary
  if (req.query.fields) {
    const allowedFields = getAllowedFields(extractResourceType(req.path));
    const requestedFields = req.query.fields.split(',');

    const invalidFields = requestedFields.filter(
      f => !allowedFields.includes(f),
    );
    if (invalidFields.length > 0) {
      logger.warn('Data minimization violation attempt', {
        userId: req.user?.user_id,
        invalidFields,
        endpoint: req.path,
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid fields requested',
        invalidFields,
      });
    }
  }

  next();
};

/**
 * Middleware to add data breach detection headers
 */
exports.breachDetectionMiddleware = (req, res, next) => {
  // Add headers for breach detection
  res.set('X-Request-ID', req.id || generateRequestId());

  next();
};

/**
 * UTILITY FUNCTIONS
 */

function extractResourceType(path) {
  const match = path.match(/\/api\/([a-z]+)/i);
  return match ? match[1] : 'unknown';
}

function extractResourceId(path) {
  const match = path.match(/\/api\/[a-z]+\/(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function extractChamaId(path) {
  const match = path.match(/\/api\/[a-z]+\/(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function extractAmount(data) {
  if (!data) return 0;
  return data?.data?.amount || data?.amount || 0;
}

function extractTransactionType(path, method) {
  if (path.includes('contributions')) return 'CONTRIBUTION';
  if (path.includes('loans')) return 'LOAN';
  if (path.includes('payouts')) return 'PAYOUT';
  if (path.includes('welfare')) return 'WELFARE';
  if (path.includes('rosca')) return 'ROSCA_DISTRIBUTION';
  return 'UNKNOWN';
}

function getAllowedFields(resourceType) {
  const fieldMaps = {
    users: ['user_id', 'email', 'first_name', 'last_name', 'phone_number'],
    chamas: ['chama_id', 'chama_name', 'member_count', 'balance'],
    contributions: ['contribution_id', 'amount', 'date', 'status'],
    loans: ['loan_id', 'amount', 'status', 'repayment_status'],
  };

  return fieldMaps[resourceType] || [];
}

function generateRequestId() {
  return Math.random().toString(36).substring(2, 11);
}

module.exports;
