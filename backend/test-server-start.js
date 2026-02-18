#!/usr/bin/env node

/**
 * Test server startup with minimal routes
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Import basic middleware
const logger = require('./utils/logger');
const { corsOptions } = require('./config/cors');
const { securityMiddleware } = require('./middleware/security');
const { responseFormatterMiddleware } = require('./utils/responseFormatter');
const { cacheMiddleware } = require('./middleware/cache');
const { validateQueryParams } = require('./middleware/queryValidation');

// Initialize database connection
require('./config/db');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5005;

// Apply security middleware FIRST
securityMiddleware(app);

// Basic health check
app.get('/api/ping', (req, res) => res.json({ success: true, message: 'pong' }));

app.get('/health', (req, res) => res.json({
  uptime: process.uptime(),
  message: 'OK',
  timestamp: Date.now(),
  port: PORT,
}));

// Trust proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Query parameter validation
app.use(validateQueryParams);

// Standard response formatter middleware
app.use(responseFormatterMiddleware);

// Cache control headers
app.use(cacheMiddleware());

// Basic API routes
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is working!' });
});

// Global error handling
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  console.error('SERVER ERROR:', err.message);
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });
  res
    .status(err.statusCode)
    .json({ success: false, message: 'Internal server error' });
});

// Start server
server.on('error', err => {
  console.error('SERVER FATAL ERROR:', err.message);
  if (err.code === 'EADDRINUSE') {
    process.exit(1);
  }
});

server.listen(PORT, async () => {
  console.log(`🚀 TEST SERVER: Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Test endpoint: http://localhost:${PORT}/api/test`);
  logger.info(`Test server running on port ${PORT}`);
});

module.exports = { app, server };
