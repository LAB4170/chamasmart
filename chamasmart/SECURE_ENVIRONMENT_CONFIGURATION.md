# SECURE ENVIRONMENT CONFIGURATION GUIDE

## 🔐 Environment Variables Security

### Quick Start

1. **Create `.env.local` (NEVER commit):**
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

2. **Verify `.env` is in `.gitignore`:**
```bash
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

3. **Update production secrets in CI/CD pipeline**

---

## 📋 COMPLETE ENVIRONMENT VARIABLE LIST

Create a `.env.local` file with these variables (DO NOT COMMIT):

### Server Configuration
```env
NODE_ENV=development              # development|staging|production
PORT=5000
LOG_LEVEL=info                   # error|warn|info|debug
ENABLE_CONSOLE_LOGS=true
```

### Database (PostgreSQL)
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=chamasmart
DB_PASSWORD=your_very_secure_password_here_32chars_minimum
DB_PORT=5432
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=10000
DB_STATEMENT_TIMEOUT_MS=60000

# For production with SSL:
DB_SSL_ENABLED=true
DB_SSL_CA=/path/to/ca-certificate.crt
DB_SSL_CERT=/path/to/client-certificate.crt
DB_SSL_KEY=/path/to/client-key.key
DB_REJECT_UNAUTHORIZED=true
```

### Redis (Rate Limiting & Caching)
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_very_secure_redis_password_here
REDIS_USER=default                # Redis 6.0+
REDIS_DB=0
REDIS_URL=redis://:password@localhost:6379

# For production with TLS:
REDIS_TLS_ENABLED=true
REDIS_CA_CERT=/path/to/ca-certificate.crt
REDIS_REJECT_UNAUTHORIZED=true
```

### JWT & Security
```env
# JWT Authentication (Change these NOW)
JWT_SECRET_V1=generate_with_node_crypto.randomBytes_64.toString_hex
JWT_SECRET_V2=leave_empty_until_key_rotation_needed
JWT_KEY_VERSION=1                 # Current active key version

JWT_EXPIRE=7d                     # Access token expiration
REFRESH_TOKEN_EXPIRE=30d          # Refresh token expiration
JWT_COOKIE_EXPIRES_IN=90d

# Session Security
SESSION_SECRET=generate_with_node_crypto.randomBytes_64.toString_hex
SESSION_MAX_AGE=86400000           # 24 hours in milliseconds

# Encryption Keys
ENCRYPTION_KEY=generate_with_node_crypto.randomBytes_32.toString_hex
ENCRYPTION_IV_GENERATION=true     # Use random IV for each encryption

# Security Headers
CONTENT_SECURITY_POLICY="default-src 'self'; script-src 'self' 'unsafe-inline'"
X_FRAME_OPTIONS=DENY
X_CONTENT_TYPE_OPTIONS=nosniff
X_XSS_PROTECTION="1; mode=block"
STRICT_TRANSPORT_SECURITY="max-age=31536000; includeSubDomains"
```

### CORS (Cross-Origin Resource Sharing)
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5000
# For production: https://yourdomain.com
```

### Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000       # 15 minutes
RATE_LIMIT_MAX_REQUESTS=5000      # Per window
AUTH_RATE_LIMIT_MAX=3             # Login attempts per window
OTP_RATE_LIMIT_MAX=5              # OTP attempts per window
PASSWORD_RESET_RATE_LIMIT_MAX=2   # Per hour
DATA_EXPORT_RATE_LIMIT_MAX=5      # Per day
```

### Email Configuration (Nodemailer)
```env
EMAIL_HOST=smtp.gmail.com         # Your SMTP server
EMAIL_PORT=587                    # Usually 587 (TLS) or 465 (SSL)
EMAIL_SECURE=true                 # true for 465 (SSL), false for 587 (TLS)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_specific_password  # NOT your regular password
EMAIL_FROM="ChamaSmart <noreply@chamasmart.app>"
EMAIL_RETRY_ATTEMPTS=3
EMAIL_RETRY_DELAY_MS=1000

# For Gmail specifically:
# 1. Enable 2FA on your account
# 2. Generate app-specific password
# 3. Use the app password in EMAIL_PASSWORD
```

### Google Cloud Storage (Optional - for file uploads)
```env
GCS_BUCKET_NAME=chamasmart-welfare-docs
GCP_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Africa's Talking API (Optional - for SMS/USSD)
```env
AFRICAS_TALKING_API_KEY=your_africas_talking_api_key
AFRICAS_TALKING_USERNAME=your_africas_talking_username
AFRICAS_TALKING_SMS_ENABLED=false  # Enable only when API key is set
AFRICAS_TALKING_2FA_ENABLED=false  # Enable for SMS 2FA
```

### Stripe / Payment Processing (Optional)
```env
STRIPE_PUBLIC_KEY=pk_live_your_public_key
STRIPE_SECRET_KEY=sk_live_your_secret_key  # NEVER expose this
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Monitoring & Logging (Optional)
```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
LOG_TO_ELASTICSEARCH=false
ELASTICSEARCH_URL=http://localhost:9200
JAEGER_ENABLED=false
JAEGER_ENDPOINT=http://localhost:14268/api/traces
METRICS_AUTH_TOKEN=your_metrics_auth_token_if_protected
```

### Development Only
```env
DEBUG_SQL_QUERIES=false           # Log all SQL queries (SLOW)
MOCK_EXTERNAL_APIS=false          # Use mock implementations
VERBOSE_LOGGING=false             # Extra logging
```

---

## 🛠️ GENERATING SECURE VALUES

### Generate Strong Secrets

```bash
# Generate JWT secret (64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use this one-liner for all:
node -e "const c=require('crypto'); console.log('JWT:', c.randomBytes(32).toString('hex')); console.log('SESSION:', c.randomBytes(32).toString('hex')); console.log('ENCRYPT:', c.randomBytes(32).toString('hex'))"
```

### Password Generation for Database/Redis

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
```

---

## 🔄 ENVIRONMENT-SPECIFIC CONFIGURATIONS

### Development (.env.local)

```env
NODE_ENV=development
PORT=5000
DEBUG_SQL_QUERIES=true
VERBOSE_LOGGING=true
MOCK_EXTERNAL_APIS=false

# Permissive CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5000

# Weaker security (DEV ONLY)
JWT_EXPIRE=30d
RATE_LIMIT_MAX_REQUESTS=100000

# Local database
DB_HOST=localhost
REDIS_HOST=localhost
```

### Staging (.env.staging - DO NOT COMMIT)

```env
NODE_ENV=staging
PORT=5000
LOG_LEVEL=info

# Limited CORS
ALLOWED_ORIGINS=https://staging.chamasmart.com

# Standard security
JWT_EXPIRE=7d
RATE_LIMIT_MAX_REQUESTS=5000

# Use staging database
DB_HOST=staging-db.chamasmart.internal
DB_SSL_ENABLED=true
REDIS_HOST=staging-redis.chamasmart.internal
REDIS_TLS_ENABLED=true
```

### Production (.env.production - USE SECRETS MANAGER)

```env
NODE_ENV=production
PORT=5000
LOG_LEVEL=warn

# Strict CORS
ALLOWED_ORIGINS=https://chamasmart.app,https://app.chamasmart.app

# Strong security
JWT_EXPIRE=7d
RATE_LIMIT_MAX_REQUESTS=5000

# Use production database
DB_HOST=prod-db.chamasmart.com
DB_SSL_ENABLED=true
DB_REJECT_UNAUTHORIZED=true
REDIS_HOST=prod-redis.chamasmart.com
REDIS_TLS_ENABLED=true
REDIS_REJECT_UNAUTHORIZED=true

# All monitoring enabled
SENTRY_DSN=https://your-prod-sentry-dsn
LOG_TO_ELASTICSEARCH=true
ELASTICSEARCH_URL=https://elastic.chamasmart.com
METRICS_AUTH_TOKEN=prod_metrics_token
```

---

## 🚀 CI/CD DEPLOYMENT

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        env:
          # These are SECRETS in GitHub (Settings > Secrets)
          NODE_ENV: production
          JWT_SECRET_V1: ${{ secrets.JWT_SECRET_V1 }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          REDIS_PASSWORD: ${{ secrets.REDIS_PASSWORD }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
        run: |
          # These env vars are automatically available
          npm ci
          npm run build
          npm start
```

### Docker Compose with Secrets

```yaml
version: '3.8'

services:
  backend:
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      JWT_SECRET_V1: ${JWT_SECRET_V1}
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    
    # Or use Docker secrets:
    secrets:
      - jwt_secret
      - db_password

secrets:
  jwt_secret:
    external: true  # Created with: docker secret create jwt_secret -
  db_password:
    external: true
```

---

## ✅ VERIFICATION CHECKLIST

Before deploying to production:

- [ ] `.env` file exists locally but NOT in git
- [ ] `.env` is in `.gitignore`
- [ ] All `process.env.*` variables are defined
- [ ] No hardcoded secrets in code
- [ ] All test secrets are in `.env.test.local`
- [ ] Secrets have been rotated from previous versions
- [ ] Database SSL is enabled
- [ ] Redis password is strong (32+ chars)
- [ ] JWT secrets are strong (64+ chars)
- [ ] All API credentials are set
- [ ] Monitoring/Sentry configured
- [ ] Rate limiting thresholds are appropriate
- [ ] CORS origins are restricted to your domains only

---

## 🔒 BEST PRACTICES

1. **Never commit .env files** - Use .env.example template instead
2. **Rotate secrets regularly** - Every 90 days recommended
3. **Use secrets manager in production** - HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault
4. **Different secrets per environment** - Never reuse production secrets in development
5. **Restrict environment variables access** - Only deploy users should see production secrets
6. **Log access to secrets** - Track who accesses what and when
7. **Use strong random secrets** - Minimum 32 characters, mix of types
8. **Disable sensitive logging** - Don't log passwords, tokens, or keys
9. **Audit environment changes** - Monitor when secrets are rotated
10. **2FA on secret management** - Protect your secrets manager access

---

## 🚨 EMERGENCY PROCEDURES

### If Secrets Are Leaked

1. **Immediately rotate ALL secrets**
2. **Invalidate all active sessions**
3. **Change database password**
4. **Regenerate JWT keys**
5. **Audit logs for unauthorized access**
6. **Update all deployed instances**
7. **Force logout all users**
8. **Enable 2FA on all accounts**
9. **Review monitoring alerts**
10. **Notify security team**

---

## 📚 ADDITIONAL RESOURCES

- [12 Factor App - Config](https://12factor.net/config)
- [OWASP Secrets Management](https://owasp.org/www-community/Secrets_Management)
- [Node.js Security Best Practices](https://nodejs.org/en/knowledge/file-system/security/introduction/)
- [dotenv Documentation](https://github.com/motdotla/dotenv)

---

**Last Updated:** January 18, 2026  
**Status:** CRITICAL - Must be implemented before production deployment
