const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

// Import new logging and security modules
const logger = require("./utils/logger");
const { requestLogger } = require("./middleware/requestLogger");
const { corsOptions } = require("./config/cors");
const {
  metricsMiddleware,
  metricsEndpoint,
  healthCheckEndpoint,
  readinessCheckEndpoint
} = require("./middleware/metrics");
require("./config/db"); // Initialize DB connection

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());

// Rate Limiting (global safeguard against abuse, tune per deployment)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Per-IP baseline; for high-scale deployments, adjust or offload to edge WAF/LB
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Auth Rate Limiting (stricter to protect login endpoints)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
});
app.use("/api/auth", authLimiter);

// ASCA-specific rate limiting (protect heavier investment/governance endpoints)
const ascaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests/min per IP for /api/asca
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/asca", ascaLimiter);

// ROSCA-specific rate limiting (protect merry-go-round endpoints)
const roscaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests/min per IP for /api/rosca
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/rosca", roscaLimiter);

// Logging with Winston
app.use(requestLogger);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Metrics middleware
app.use(metricsMiddleware);

// REMOVED: Insecure debug logging that exposed sensitive data
// Logging is now handled by requestLogger middleware with sanitization

// API Routes
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

// Health and readiness endpoints
app.get("/api/health", healthCheckEndpoint);
app.get("/api/ready", readinessCheckEndpoint);
app.get("/metrics", metricsEndpoint);

app.use("/api/join-requests", require("./routes/joinRequests"));
app.use("/api/notifications", require("./routes/notifications"));

// Serve static files from the React app build directory
// Serve static files from the React app build directory
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  // Catch all handler: send back React's index.html file for client-side routing
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
} else {
  // In development, we don't serve the frontend from here.
  // The user should access the frontend via the Vite server (usually port 5173).
  app.get("/", (req, res) => {
    res.send("API is running. For frontend, access localhost:5173");
  });
}

// Global error handler
app.use((err, req, res, next) => {
  // Log error with context
  logger.logError(err, {
    method: req.method,
    url: req.url,
    userId: req.user?.user_id,
    ip: req.ip,
  });

  // Send appropriate response
  const statusCode = err.status || err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || "Internal server error",
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception - shutting down", {
    error: err.message,
    stack: err.stack,
  });

  // Give logger time to write, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start server
const http = require("http");
const pool = require("./config/db");
const redis = require("./config/redis");
const server = http.createServer(app);
const socket = require("./socket");

// Initialize Socket.io
socket.init(server);

// Initialize Scheduler (Safely)
try {
  const { initScheduler } = require('./scheduler');
  initScheduler();
  logger.info('Penalty Scheduler initialized');
} catch (schedulerErr) {
  logger.error('Failed to initialize scheduler', { error: schedulerErr.message });
}

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      pid: process.pid,
    });

    logger.info(`API URL: http://localhost:${PORT}`);
    logger.info(`Metrics available at: http://localhost:${PORT}/metrics`);
    logger.info(`Health check at: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown logic
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Close HTTP server (and Socket.io connections)
    server.close(() => {
      logger.info("HTTP server closed");
    });

    try {
      // Close Redis connection
      if (redis && typeof redis.quit === 'function') {
        await redis.quit();
        logger.info("Redis connection closed");
      }

      // Close database pool
      await pool.end();
      logger.info("PostgreSQL pool has ended");

      logger.info("Graceful shutdown complete. Exiting.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", { error: err.message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Export app for testing (supertest)
module.exports = app;
