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
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Auth Rate Limiting (Stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login/register requests per windowMs
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

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/chamas", require("./routes/chamas"));
app.use("/api/members", require("./routes/members"));
app.use("/api/contributions", require("./routes/contributions"));
app.use("/api/meetings", require("./routes/meetings"));

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
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Catch all handler: send back React's index.html file for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});
