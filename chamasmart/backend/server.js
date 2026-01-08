const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
require("dotenv").config();

// Import custom modules
const logger = require("./utils/logger");
const { requestLogger } = require("./middleware/requestLogger");
const { corsOptions } = require("./config/cors");
const {
  metricsMiddleware,
  healthCheckEndpoint,
  metricsEndpoint,
  readinessCheckEndpoint,
} = require("./middleware/metrics");
const { securityMiddleware } = require("./middleware/security");

// Initialize database connection
require("./config/db");

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5005;

// Basic health check (no middleware)
app.get("/api/ping", (req, res) => res.json({ success: true, message: "pong" }));
app.get("/health", (req, res) => res.json({
  uptime: process.uptime(),
  message: 'OK',
  timestamp: Date.now(),
  port: PORT
}));

// Apply security middleware
securityMiddleware(app);

// Trust proxy
app.set("trust proxy", 1);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Request logging
app.use(requestLogger);

// Metrics
app.use(metricsMiddleware);

// API Routes
app.get("/api/ping", (req, res) => res.json({ success: true, message: "pong" }));

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
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API endpoint ${req.originalUrl} not found` });
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
  console.error('SERVER ERROR:', err.message);
  logger.error({ message: err.message, stack: err.stack, method: req.method, url: req.url });
  res.status(err.statusCode).json({ success: false, message: "Internal server error" });
});

// Start server
server.on('error', (err) => {
  console.error('SERVER FATAL ERROR:', err.message);
  if (err.code === 'EADDRINUSE') {
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`STABILIZED: Server running on port ${PORT}`);
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
