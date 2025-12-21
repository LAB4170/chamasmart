const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
require("./config/db"); // Initialize DB connection

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 100 to accommodate dashboard requests
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Auth Rate Limiting (Stricter but usable)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased from 20 for multiple tabs/testing
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
});
app.use("/api/auth", authLimiter);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chamas", require("./routes/chamas"));
app.use("/api/members", require("./routes/members"));
app.use("/api/contributions", require("./routes/contributions"));
app.use("/api/meetings", require("./routes/meetings"));
app.use("/api/invites", require("./routes/invites"));
app.use("/api/loans", require("./routes/loans"));
app.use("/api/payouts", require("./routes/payouts"));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "UP", message: "Server is healthy" });
});
app.use("/api/join-requests", require("./routes/joinRequests"));
app.use("/api/notifications", require("./routes/notifications"));


// API Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ChamaSmart API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

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
// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error Handler:", err.stack);

  // Try to log to file, but don't crash if it fails
  try {
    const logPath = path.join(__dirname, 'global_errors.txt');
    require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] Global Error: ${err.stack}\n`);
  } catch (logErr) {
    console.error("Failed to write to log file:", logErr.message);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  // Optional: process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  // Optional: process.exit(1);
});

// Start server
const http = require("http");
const pool = require("./config/db");
const redis = require("./config/redis");
const server = http.createServer(app);
const socket = require("./socket");

// Initialize Socket.io
socket.init(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});

// Graceful shutdown logic
const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Close HTTP server (and Socket.io connections)
  server.close(() => {
    console.log("HTTP server closed.");
  });

  try {
    // Close Redis connection
    if (redis && typeof redis.quit === 'function') {
      await redis.quit();
      console.log("Redis connection closed.");
    }

    // Close database pool
    await pool.end();
    console.log("PostgreSQL pool has ended.");

    console.log("Graceful shutdown complete. Exiting.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err.message);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
