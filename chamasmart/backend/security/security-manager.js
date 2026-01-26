const { createLogger } = require("../../utils/logger");
const EncryptionService = require("./modules/encryption");
const AuditLogger = require("./modules/audit-logger");
const rateLimiters = require("./modules/rate-limiting");
const KeyManager = require("./modules/key-management");

class SecurityManager {
  constructor(config = {}) {
    this.config = {
      strictMode: true,
      ...config,
    };

    this.logger = createLogger("security");
    this.initialized = false;
    this.modules = {};

    // Initialize with error handling
    this.initialize = this.initialize.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }

  /**
   * Initialize all security modules
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // 1. Initialize key manager first
      this.keyManager = new KeyManager({
        encryptionKey: this.config.encryption?.key,
      });
      await this.keyManager.initialize();

      // 2. Initialize encryption service
      this.encryption = new EncryptionService({
        key: this.keyManager.getCurrentKey(),
        algorithm: this.config.encryption?.algorithm,
        ivLength: this.config.encryption?.ivLength,
        saltLength: this.config.encryption?.saltLength,
      });

      // 3. Initialize audit logger
      this.auditLogger = new AuditLogger({
        enableBatching: this.config.auditLogging?.enableBatching,
        batchSize: this.config.auditLogging?.batchSize,
        strictMode: this.config.auditLogging?.strictMode,
      });

      // 4. Initialize rate limiting
      this.rateLimiting = {
        ...rateLimiters,
        // Add rate limiting middleware
        middleware: (options = {}) => {
          const name = options.name || "apiGeneral";
          const config = rateLimiters.getConfig(name);
          return rateLimiters.createCustomLimiter({
            ...config,
            ...options,
            keyGenerator: rateLimiters.keyGenerators.authenticated,
          });
        },
      };

      // 5. Initialize other security components
      await this._initializeAuth();
      await this._initializeCSP();
      await this._initializeCORS();

      this.initialized = true;
      this.logger.info("Security manager initialized successfully");

      // Start background tasks
      this._startBackgroundTasks();
    } catch (error) {
      this.logger.error("Failed to initialize security manager", { error });
      if (this.config.strictMode) {
        throw error;
      }
    }
  }

  /**
   * Initialize authentication module
   * @private
   */
  async _initializeAuth() {
    // JWT verification middleware
    this.authenticate = async (req, res, next) => {
      try {
        const token = this._extractToken(req);
        if (!token) {
          return res.status(401).json({ error: "Authentication required" });
        }

        const decoded = await this.keyManager.verifyToken(token);
        req.user = decoded;
        next();
      } catch (error) {
        this.auditLogger.logAuthenticationEvent(
          req.user?.id,
          "token_verification_failed",
          false,
          req.ip,
          req.get("user-agent"),
          error.message,
        );

        if (error.name === "TokenExpiredError") {
          return res.status(401).json({ error: "Token expired" });
        }
        return res.status(401).json({ error: "Invalid token" });
      }
    };

    // Role-based access control
    this.authorize = (roles = []) => {
      return (req, res, next) => {
        if (!req.user) {
          return res.status(401).json({ error: "Authentication required" });
        }

        if (roles.length && !roles.includes(req.user.role)) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        next();
      };
    };
  }

  /**
   * Initialize Content Security Policy
   * @private
   */
  async _initializeCSP() {
    const defaultSrc = ["'self'"];
    const scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
    const styleSrc = ["'self'", "'unsafe-inline'"];
    const imgSrc = ["'self'", "data:", "https://*.example.com"];
    const connectSrc = ["'self'"];

    if (process.env.NODE_ENV === "development") {
      scriptSrc.push("http://localhost:*", "ws://localhost:*");
      connectSrc.push("ws://localhost:*");
    }

    this.csp = {
      directives: {
        defaultSrc,
        scriptSrc,
        styleSrc,
        imgSrc,
        connectSrc,
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    };
  }

  /**
   * Initialize CORS
   * @private
   */
  async _initializeCORS() {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim());

    this.corsOptions = {
      origin: (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          process.env.NODE_ENV === "development"
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 600,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
  }

  /**
   * Start background security tasks
   * @private
   */
  _startBackgroundTasks() {
    // Clean old audit logs weekly
    this.auditCleanupInterval = setInterval(
      () =>
        this.auditLogger.cleanOldLogs(this.config.auditLogging?.retentionDays),
      7 * 24 * 60 * 60 * 1000, // Weekly
    );

    // Rotate keys monthly
    this.keyRotationInterval = setInterval(
      () => this.keyManager.rotateKeys(),
      30 * 24 * 60 * 60 * 1000, // Monthly
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    clearInterval(this.auditCleanupInterval);
    clearInterval(this.keyRotationInterval);

    await this.auditLogger.stopBatchFlushing();
    await this.keyManager.shutdown();

    this.initialized = false;
    this.logger.info("Security manager shutdown complete");
  }

  /**
   * Extract JWT token from request
   * @private
   */
  _extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    return req.cookies?.token || req.query?.token;
  }
}

module.exports = SecurityManager;
