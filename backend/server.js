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
// API ROUTES
// ============================================================================

// Health & Observability (first, before auth)
app.get("/api/ping", (req, res) => res.json({ success: true, message: "pong" }));
app.get("/health", healthCheckEndpoint);
app.get("/api/health", healthCheckEndpoint);
app.get("/readiness", readinessCheckEndpoint);
app.get("/metrics", metricsEndpoint);

// Authentication routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth/v2", require("./routes/auth")); // Backward compatibility alias

app.use("/api/chamas", require("./routes/chamas"));
app.use("/api/members", require("./routes/members"));
app.use("/api/contributions", require("./routes/contributions"));
app.use("/api/payments/mpesa", require("./routes/mpesa"));
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
app.use("/api/dividends", require("./routes/dividendRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));
app.use("/api/sessions", require("./routes/sessions"));


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
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err.message);
  if (isDev) {
    console.error(err.stack);
  }

  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    statusCode: statusCode,
  });

  res.status(statusCode).json({
    success: false,
    message: (statusCode === 500 && !isDev) ? "Internal server error" : err.message,
    error: isDev ? err.stack : undefined,
  });
});

// Start server
server.on("error", (err) => {
  logger.error("SERVER FATAL ERROR", { code: err.code, message: err.message });
  if (err.code === "EADDRINUSE") {
    process.exit(1);
  }
});

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", async () => {
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

    // Initialize Background Scheduler
    const { initScheduler } = require('./utils/scheduler');
    initScheduler();
  });
}

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

// Graceful Shutdown Logic
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // 1. Close HTTP server (stop accepting new connections)
  server.close(() => {
    logger.info('HTTP server closed.');
  });

  // 2. Close Socket.io and Redis (via socket module)
  try {
    const socketModule = require("./socket");
    await socketModule.close();
    logger.info('Socket.io and Redis adapters closed.');
  } catch (err) {
    logger.warn('Error closing socket module', { error: err.message });
  }

  // 3. Close Database Pool
  try {
    const pool = require("./config/db");
    await pool.end();
    logger.info('Database pool closed.');
  } catch (err) {
    logger.error('Error closing database pool', { error: err.message });
  }

  logger.info('Graceful shutdown completed. Exiting.');
  process.exit(0);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
module.exports.server = server;
