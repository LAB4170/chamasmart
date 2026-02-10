const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
require("dotenv").config();

// Import custom modules
const logger = require("./utils/logger");
const { requestLogger } = require("./middleware/enhancedRequestLogger");
const { corsOptions } = require("./config/cors");
const {
  metricsMiddleware,
  healthCheckEndpoint,
  metricsEndpoint,
  readinessCheckEndpoint,
} = require("./middleware/metrics");
const { securityMiddleware } = require("./middleware/security");
const { responseFormatterMiddleware } = require("./utils/responseFormatter");
const { validateQueryParams } = require("./middleware/queryValidation");

// Initialize database connection
require("./config/db");

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5005;

// Apply security middleware FIRST (before all routes)
securityMiddleware(app);

// Basic health check (no middleware)
app.get("/api/ping", (req, res) =>
  res.json({ success: true, message: "pong" }),
);
app.get("/health", (req, res) =>
  res.json({
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    port: PORT,
  }),
);

// Trust proxy
app.set("trust proxy", 1);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Request logging
app.use(requestLogger);

// Query parameter validation
app.use(validateQueryParams);

// Standard response formatter middleware
app.use(responseFormatterMiddleware);

// Metrics
app.use(metricsMiddleware);

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

// API Routes
app.get("/api/ping", (req, res) =>
  res.json({ success: true, message: "pong" }),
);

// Legacy auth routes (existing)
app.use("/api/auth", require("./routes/auth"));

// NEW: Multi-option auth routes (Email OTP, Phone OTP, Google OAuth, API Keys)
app.use("/api/auth/v2", require("./routes/authV2"));

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
app.get("/health", healthCheckEndpoint);
app.get("/metrics", metricsEndpoint);
app.get("/api/health", healthCheckEndpoint);
app.get("/readiness", readinessCheckEndpoint);

// Serve static assets
const distPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Final Catch-all Middleware (Replaces app.get('*'))
app.use((req, res, next) => {
  // If API route not found
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({
      success: false,
      message: `API endpoint ${req.originalUrl} not found`,
    });
  }

  // If Static file not found, fallback to index.html (SPA)
  if (fs.existsSync(distPath)) {
    return res.sendFile(path.join(distPath, "index.html"));
  }

  // Otherwise 404
  res.status(404).json({ success: false, message: "Resource not found" });
});

// Global error handling
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  console.error("SERVER ERROR:", err.message);
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });
  res
    .status(err.statusCode)
    .json({ success: false, message: "Internal server error" });
});

// Start server
server.on("error", (err) => {
  console.error("SERVER FATAL ERROR:", err.message);
  if (err.code === "EADDRINUSE") {
    process.exit(1);
  }
});

server.listen(PORT, async () => {
  console.log(`STABILIZED: Server running on port ${PORT}`);
  logger.info(`Server running on port ${PORT}`);

  // Run health checks
  if (process.env.NODE_ENV !== "test") {
    const { performHealthCheck } = require("./utils/healthCheck");
    try {
      await performHealthCheck();
    } catch (error) {
      console.error("Health check error:", error);
    }
  }
});

// Initialize Socket.io (if configured) except during unit tests to avoid
// attempting external Redis connections in CI/test environments.
if (process.env.NODE_ENV !== "test") {
  try {
    const socketModule = require("./socket");
    // init is async but we don't need to block server start in tests
    socketModule.init(server).catch((err) => {
      logger.error("Socket.io initialization failed", { error: err.message });
    });
  } catch (err) {
    logger.warn("Socket module not available or failed to load", {
      error: err.message,
    });
  }
} else {
  logger.info("Skipping Socket.io initialization in test environment");
}

module.exports = app;
module.exports.server = server;
