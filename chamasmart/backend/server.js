const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
require("dotenv").config();

// Import custom modules
const logger = require("./utils/logger");
const { requestLogger } = require("./middleware/requestLogger");
const { corsOptions } = require("./config/cors");
const {
  metricsMiddleware,
  metricsEndpoint,
  healthCheckEndpoint,
  readinessCheckEndpoint,
} = require("./middleware/metrics");
const { securityMiddleware } = require("./middleware/security");

// Initialize database connection
require("./config/db");

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Apply security middleware
securityMiddleware(app);

// Trust proxy if behind a reverse proxy (e.g., Nginx)
app.set("trust proxy", 1);

// Apply CORS with configuration
app.use(cors(corsOptions));

// Parse JSON bodies (with size limit)
app.use(express.json({ limit: "10kb" }));

// Parse URL-encoded bodies (with size limit)
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Request logging
app.use(requestLogger);

// Add request time to all requests
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Metrics middleware
app.use(metricsMiddleware);

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
app.use("/api/join-requests", require("./routes/joinRequests"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/welfare", require("./routes/welfareRoutes"));

// Health and metrics endpoints
app.get("/health", healthCheckEndpoint);
app.get("/ready", readinessCheckEndpoint);
app.get("/metrics", metricsEndpoint);

// Serve static files from the React app build directory in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  // Handle SPA routing - Express 5 compatible catch-all
  app.get("(.*)", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

// 404 handler - Express 5 compatible (using use instead of all("*"))
app.use((req, res, next) => {
  res.status(404).json({
    status: "fail",
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  // Default error status and message
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error with context
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === "production" && !err.isOperational) {
    err.message = "Something went wrong!";
  }

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
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! Shutting down...");
  logger.error(err.name, err.message);

  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(err.name, err.message);

  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`${signal} received: shutting down gracefully...`);

  // Close the server
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

  // Force close server after 10 seconds
  setTimeout(() => {
    logger.error("Forcing server shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start server
server.listen(PORT, () => {
  logger.info(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`
  );
  logger.info(`API URL: http://localhost:${PORT}`);
});

// Export app for testing (supertest)
module.exports = app;
