# Security Quick Reference

## Initialization

```javascript
const { security } = require("./security");

// Initialize all security modules
await security.initialize();
```

## JWT Authentication

### Generate Token

```javascript
const token = await security.generateToken({
  userId: 123,
  roles: ["user"],
  expiresIn: "24h",
});
```

### Verify Token

```javascript
try {
  const decoded = await security.verifyToken(token);
  // Token is valid
} catch (error) {
  // Handle invalid token
}
```

## Encryption

### Encrypt Data

```javascript
const encrypted = security.encrypt("sensitive data");
// Returns: { iv: '...', encryptedData: '...', authTag: '...' }
```

### Decrypt Data

```javascript
const decrypted = security.decrypt(encrypted);
// Returns: 'sensitive data'
```

## Rate Limiting

### Middleware

```javascript
// Basic usage
app.use("/api", security.rateLimiting.middleware());

// Custom limits
app.use(
  "/api/auth",
  security.rateLimiting.middleware({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 requests per window
  }),
);
```

### Direct Usage

```javascript
const limit = await security.rateLimiting.checkRateLimit({
  key: "user:123",
  windowMs: 60000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

if (!limit.allowed) {
  throw new Error(
    `Rate limit exceeded. Try again in ${limit.retryAfter} seconds`,
  );
}
```

## Audit Logging

### Log Events

```javascript
await security.auditLogger.log({
  eventType: "password_change",
  action: "User changed password",
  user: { id: 123 },
  request: { ip: "192.168.1.1" },
  level: "info",
});
```

### Query Logs

```javascript
const logs = await security.auditLogger.queryLogs({
  userId: 123,
  eventType: "login",
  startDate: "2023-01-01",
  limit: 50,
});
```

## Common Tasks

### Rotate JWT Key

```javascript
// Generate new key
const newKey = crypto.randomBytes(32).toString("hex");

// Update environment and restart server
process.env.JWT_SECRET_V2 = newKey;
process.env.JWT_KEY_VERSION = "2";
```

### Clean Up Old Logs

```javascript
// Remove logs older than 90 days
const count = await security.auditLogger.cleanupOldLogs(90);
console.log(`Removed ${count} old log entries`);
```

## Error Handling

### Common Errors

| Error Code            | Description               | Solution                  |
| --------------------- | ------------------------- | ------------------------- |
| `RATE_LIMIT_EXCEEDED` | Too many requests         | Wait and retry            |
| `INVALID_TOKEN`       | Invalid or expired token  | Refresh token             |
| `ENCRYPTION_ERROR`    | Failed to encrypt/decrypt | Check encryption key      |
| `AUDIT_LOG_ERROR`     | Failed to log event       | Check database connection |

## Environment Variables

| Variable                  | Required | Default   | Description                |
| ------------------------- | -------- | --------- | -------------------------- |
| `JWT_SECRET`              | Yes      | -         | JWT signing key            |
| `ENCRYPTION_KEY`          | Yes      | -         | Encryption key             |
| `REDIS_HOST`              | No       | localhost | Redis server host          |
| `REDIS_PORT`              | No       | 6379      | Redis server port          |
| `RATE_LIMIT_WINDOW_MS`    | No       | 900000    | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No       | 100       | Max requests per window    |

## Troubleshooting

### Enable Debug Logging

```javascript
const logger = require("../utils/logger");
logger.level = "debug";
```

### Check Redis Connection

```bash
redis-cli ping
```

### Verify JWT Token

```bash
# Using jwt-cli
echo $TOKEN | jwt decode -
```

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/your-repo/issues).
