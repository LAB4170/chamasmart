const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// Import API Documentation
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const swaggerDefinition = require("./swaggerDef");

// Import custom modules
const logger = require("./utils/logger");
const { requestId } = logger;
const {
  requestLogger,
  detailedRequestLogger,
} = require("./middleware/enhancedRequestLogger");
const { corsOptions } = require("./config/cors");
const {
  healthCheckEndpoint,
  metricsEndpoint,
  readinessCheckEndpoint,
} = require("./middleware/metrics");
const { securityMiddleware } = require("./middleware/security");
const { responseFormatterMiddleware } = require("./utils/responseFormatter");
const { validateQueryParams } = require("./middleware/queryValidation");

// Import enhanced security and error handling
const {
  helmetConfig,
  xssProtection,
  sqlInjectionProtection,
  suspiciousActivityDetection,
  securityHeaders,
  ipRateLimit,
  csrfProtection,
} = require("./middleware/enhancedSecurity");
const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/enhancedErrorHandler");

// Import advanced caching
const {
  userProfileCache,
  chamaListCache,
  chamaDetailsCache,
  loanListCache,
  contributionListCache,
  meetingListCache,
} = require("./middleware/advancedCache");

// Initialize database connection
require("./config/db");

// Initialize Firebase Admin
require("./config/firebase");

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5005;

// Middleware for parsing cookies (required for CSRF)
app.use(cookieParser());

// Configure Swagger Documentation
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: ["./routes/*.js", "./controllers/*.js"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Apply enhanced security middleware FIRST (before all routes)
app.use(helmetConfig);
app.use(securityHeaders);
app.use(ipRateLimit);
app.use(xssProtection);
app.use(sqlInjectionProtection);
app.use(suspiciousActivityDetection);

// API Documentation endpoint
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "ChamaSmart API Documentation",
  }),
);

// Swagger JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Basic health check (no middleware)
app.get("/api/ping", (req, res) =>
  res.json({ success: true, message: "pong" }),
);

// Apply CSRF protection after static files but before other routes
app.use(csrfProtection);

// CSRF Token endpoint
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Trust proxy
app.set("trust proxy", 1);

// Core middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Add request ID and logging middleware
app.use(requestId); // Add request ID to all requests
app.use(requestLogger); // Main request logging

// Detailed request logging in development
if (process.env.NODE_ENV === "development") {
  app.use(detailedRequestLogger);
}

// Request validation
app.use(validateQueryParams);

// Response formatting
app.use(responseFormatterMiddleware);

// Metrics
// Note: metricsMiddleware will be added later after import

// ============================================================================
// CRITICAL: Rate Limiting Middleware for Authentication
// ============================================================================

// Import enhanced rate limiting
const {
  checkLoginRateLimit,
  checkOtpRateLimit,
  checkPasswordResetRateLimit,
} = require("./security/enhancedRateLimiting");

// Rate limit: Login attempts (3 per 15 minutes per email)
app.use("/api/auth/login", async (req, res, next) => {
  try {
    // Use email if provided, otherwise IP
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
    logger.error("Rate limit check failed", {
      context: "rate_limit_login",
      error: err.message,
    });
    next(); // Continue on error to avoid breaking auth
  }
});

// Rate limit: OTP verification (5 per 15 minutes)
app.use("/api/auth/verify-phone", async (req, res, next) => {
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
    logger.error("Rate limit check failed", {
      context: "rate_limit_otp",
      error: err.message,
    });
    next();
  }
});

// Rate limit: Password reset (2 per hour)
app.use("/api/auth/password-reset", async (req, res, next) => {
  try {
    const identifier = req.body.email || req.ip;
    const isLimited = await checkPasswordResetRateLimit(identifier, req.ip);

    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: "Too many password reset requests. Please try again later.",
      });
    }
    next();
  } catch (err) {
    logger.error("Rate limit check failed", {
      context: "rate_limit_password",
      error: err.message,
    });
    next();
  }
});

logger.info("Rate limiting middleware activated", {
  context: "server_init",
  limits: {
    login: "3 per 15 minutes",
    otp: "5 per 15 minutes",
    passwordReset: "2 per hour",
  },
});

// ============================================================================
// End Rate Limiting Section
// ============================================================================

// ============================================================================
// Metrics and Monitoring
// ============================================================================
// Note: Advanced metrics temporarily disabled for startup stability
// TODO: Re-enable after fixing dependencies

// Simple metrics endpoint (requires authentication)
app.get("/api/metrics", (req, res) => {
  // Check if user is authenticated for metrics access
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required for metrics access",
    });
  }

  // Return basic metrics for now
  res.json({
    success: true,
    data: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    },
  });
});

// ============================================================================
// API Routes
// ============================================================================

// Legacy auth routes (existing)
app.use("/api/auth", require("./routes/auth"));

app.use("/api/chamas", require("./routes/chamas"));
app.use("/api/members", require("./routes/members"));
app.use("/api/contributions", require("./routes/contributions"));
app.use("/api/meetings", require("./routes/meetings"));
app.use("/api/invites", require("./routes/invites"));
app.use("/api/loans", require("./routes/loans"));
app.use("/api/payouts", require("./routes/payouts"));
app.use("/api/rosca", require("./routes/roscaRoutes"));
app.use("/api/users", require("./routes/users"));
app.use("/api/asca", require("./routes/asca"));
app.use("/api/join-requests", require("./routes/joinRequests"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/welfare", require("./routes/welfareRoutes"));

// Health/Metrics
app.get("/metrics", metricsEndpoint);
app.get("/api/health", healthCheckEndpoint);
app.get("/readiness", readinessCheckEndpoint);

// Serve static assets
const distPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Middle catch-all and legacy error handling removed in favor of enhanced handlers at the end

// Initialize Socket.io (if configured) except during unit tests to avoid
// attempting external Redis connections in CI/test environments.
if (process.env.NODE_ENV !== "test") {
  try {
    const socketModule = require("./socket");
    // init is async but we don't need to block server start in tests
    socketModule.init(server).catch((err) => {
      console.error("Socket.io initialization failed:", err.message);
    });
  } catch (err) {
    console.warn("Socket module not available or failed to load:", err.message);
  }
} else {
  console.log("Skipping Socket.io initialization in test environment");
}

// ============================================================================
// ENHANCED ERROR HANDLING (must be last)
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Handle server errors
server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
  if (err.code === "EADDRINUSE") {
    console.error(`ERROR: Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Only start the server if this file is run directly (not when imported as a module)
if (require.main === module) {
  // Start the server
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    logger.info(`Server started on port ${PORT}`, {
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:", error);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("UNHANDLED REJECTION at:", promise, "reason:", reason);
  });
}

module.exports = app;
module.exports.server = server;
