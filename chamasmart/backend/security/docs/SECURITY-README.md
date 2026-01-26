# Security Module Documentation

## Overview

This document provides comprehensive documentation for the security module of the ChamaSmart application. The security module is responsible for handling authentication, authorization, encryption, rate limiting, and audit logging.

## Table of Contents

- [Architecture](#architecture)
- [Modules](#modules)
- [Configuration](#configuration)
- [Usage](#usage)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Architecture

The security module follows a modular architecture with the following components:

- **Security Manager**: Central coordinator for all security-related functionality
- **Key Management**: Handles JWT key rotation and management
- **Encryption**: Provides data encryption and decryption services
- **Audit Logging**: Centralized logging of security events
- **Rate Limiting**: Protects against brute force and DDoS attacks

## Modules

### 1. Security Manager (`security-manager.js`)

The main entry point for security-related operations. Initializes and coordinates all security modules.

### 2. Key Management (`modules/key-management.js`)

Manages JWT keys with support for key rotation and versioning.

### 3. Encryption (`modules/encryption.js`)

Provides encryption and decryption services using AES-256-GCM.

### 4. Audit Logging (`modules/audit-logger.js`)

Centralized logging of security events with database storage.

### 5. Rate Limiting (`modules/rate-limiting.js`)

Implements distributed rate limiting using Redis.

## Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
JWT_ALGORITHM=HS256
JWT_KEY_VERSION=1
JWT_SECRET_V1=your-secret-key-v1
JWT_SECRET_V2=your-secret-key-v2

# Encryption
ENCRYPTION_KEY=your-encryption-key

# Redis (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Usage

### Initialization

```javascript
const { security } = require("./security");

// Initialize security module
await security.initialize();

// Example: Using encryption
const encrypted = security.encrypt("sensitive data");
const decrypted = security.decrypt(encrypted);

// Example: Rate limiting middleware
app.use("/api", security.rateLimiting.middleware());
```

### Audit Logging

```javascript
// Log a security event
await security.auditLogger.log({
  eventType: "login",
  action: "User login",
  user: { id: 123 },
  request: {
    ip: "192.168.1.1",
    headers: { "user-agent": "Mozilla/5.0" },
  },
  details: { method: "password" },
  level: "info",
});
```

## Best Practices

1. **Key Management**
   - Rotate JWT keys regularly
   - Store keys in environment variables or a secure key management system
   - Never commit secrets to version control

2. **Encryption**
   - Use strong encryption algorithms (AES-256-GCM)
   - Rotate encryption keys periodically
   - Store encryption keys securely

3. **Rate Limiting**
   - Implement rate limiting on all public endpoints
   - Adjust rate limits based on endpoint sensitivity
   - Monitor and adjust limits based on traffic patterns

4. **Audit Logging**
   - Log all security-sensitive operations
   - Include relevant context in log entries
   - Regularly review and analyze audit logs

## Troubleshooting

### Common Issues

1. **Rate Limiting Not Working**
   - Check Redis connection
   - Verify rate limit configuration
   - Check for conflicting middleware

2. **JWT Verification Failing**
   - Verify JWT secret matches
   - Check token expiration
   - Ensure clock synchronization

3. **Encryption/Decryption Errors**
   - Verify encryption key
   - Check for data corruption
   - Ensure consistent encryption parameters

### Logging

Enable debug logging for troubleshooting:

```javascript
const logger = require("../utils/logger");
logger.level = "debug";
```

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
