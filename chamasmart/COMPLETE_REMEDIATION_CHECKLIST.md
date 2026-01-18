# 🛡️ API & KEYS SECURITY - COMPLETE REMEDIATION CHECKLIST

**Date:** January 18, 2026  
**Severity:** 🔴 CRITICAL - Must be completed before production deployment  
**Estimated Time:** 2-4 hours (emergency), 1-2 weeks (full hardening)

---

## 🚨 EMERGENCY FIX (MUST DO TODAY - 2 Hours)

### Step 1: Stop Exposure (15 minutes)

- [ ] **Remove .env from git history**
  ```bash
  cd c:\Users\lewis\Desktop\chamasmart
  node backend/scripts/remove-secrets-from-git.js
  ```
  - Backup created: `chamasmart-backup-*.bundle`
  - .env removed from all commits
  - Force push completed

- [ ] **Verify .env is gone from git**
  ```bash
  git log --all --full-history -- .env | head -1
  # Should return nothing if successful
  ```

- [ ] **Ensure .env is in .gitignore**
  ```bash
  cat .gitignore | grep "\.env"
  # Should show .env listed
  ```

### Step 2: Rotate Secrets (30 minutes)

- [ ] **Generate new JWT_SECRET_V1**
  ```bash
  node -e "console.log('New JWT_SECRET_V1:', require('crypto').randomBytes(32).toString('hex'))"
  ```
  Store this value (32 chars minimum, 64 chars recommended)

- [ ] **Generate new SESSION_SECRET**
  ```bash
  node -e "console.log('New SESSION_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Generate new ENCRYPTION_KEY**
  ```bash
  node -e "console.log('New ENCRYPTION_KEY:', require('crypto').randomBytes(32).toString('base64'))"
  ```

- [ ] **Update in deployment (CI/CD, environment, etc.)**
  - If using GitHub Actions: Add to Settings > Secrets
  - If using GitLab: Add to CI/CD > Variables
  - If using Docker: Update docker-compose secrets
  - If using Kubernetes: Update secrets manifest

- [ ] **Restart all backend services with new secrets**
  ```bash
  npm stop
  npm start
  # All new tokens will use new secret
  ```

### Step 3: Invalidate Old Sessions (15 minutes)

- [ ] **Force logout all users**
  ```bash
  psql -U postgres -d chamasmart -c "TRUNCATE refresh_tokens CASCADE;"
  ```
  - All active sessions invalidated
  - Users must login again with new credentials

- [ ] **Clear Redis cache (optional but recommended)**
  ```bash
  redis-cli FLUSHDB
  ```

### Step 4: Change Database Password (15 minutes)

- [ ] **Generate new database password**
  ```bash
  # Linux/Mac
  openssl rand -base64 32
  
  # Windows PowerShell
  [Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
  ```

- [ ] **Change PostgreSQL password**
  ```bash
  psql -U postgres -d chamasmart -c "ALTER USER postgres WITH PASSWORD 'new_password_here';"
  ```

- [ ] **Update connection strings everywhere**
  - docker-compose.yml
  - .env.local (local development)
  - CI/CD environment variables
  - Kubernetes secrets
  - Application configuration

- [ ] **Verify connection with new password**
  ```bash
  psql -U postgres -h localhost -d chamasmart -c "SELECT 1;"
  ```

### Step 5: Verify Nothing Broke (15 minutes)

- [ ] **Check backend health endpoint**
  ```bash
  curl http://localhost:5000/api/health
  # Should return { uptime: ..., message: "OK", ... }
  ```

- [ ] **Test login flow**
  ```bash
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}'
  # Should return token (not 500 error)
  ```

- [ ] **Check logs for errors**
  ```bash
  tail -f backend/logs/*.log
  # Should not show authentication or connection errors
  ```

- [ ] **Verify rate limiting still works**
  ```bash
  # Try login 4 times rapidly
  for i in {1..4}; do
    curl -X POST http://localhost:5000/api/auth/login \
      -d '{"email":"test@test.com","password":"pass"}' &
  done
  # 4th request should get 429 (Too Many Requests)
  ```

---

## 📋 SHORT-TERM FIXES (This Week - 24 Hours)

### GitHub/Git Repository Security

- [ ] **Comprehensive .gitignore update**
  Add to `.backend/.gitignore`:
  ```gitignore
  # Environment variables (CRITICAL)
  .env
  .env.local
  .env.*.local
  .env.production.local
  .env.test.local
  
  # IDE/Editor
  .idea/
  .vscode/
  *.swp
  *.swo
  *~
  
  # OS
  .DS_Store
  Thumbs.db
  
  # Sensitive files
  *.pem
  *.key
  *.keystore
  *.jks
  secrets/
  private/
  
  # Build/Dist
  dist/
  build/
  coverage/
  
  # Logs
  logs/
  npm-debug.log*
  yarn-debug.log*
  yarn-error.log*
  ```

- [ ] **Test .gitignore works**
  ```bash
  git check-ignore -v .env
  git check-ignore -v backend/.env.local
  # Should all show as ignored
  ```

- [ ] **Enable branch protection on main**
  - GitHub: Settings > Branches > Add rule
  - Require status checks
  - Require code reviews
  - Dismiss stale reviews
  - Require branches up to date

- [ ] **Enable commit signing (optional but recommended)**
  ```bash
  git config user.signingkey YOUR_GPG_KEY
  git config commit.gpgsign true
  ```

### Code Security Updates

- [ ] **Update tokenManager.js to use new key management**
  - Import from `backend/security/keyManagement.js`
  - Use `getKeyManager().getActiveKey()`
  - Use `getKeyManager().getActiveKeyVersion()` in token header

- [ ] **Implement key rotation support**
  - Store keyid in JWT header
  - Verify using correct key version
  - Support multiple keys during rotation

- [ ] **Secure test environment**
  - Remove hardcoded secrets from `backend/tests/setup.js`
  - Create `.env.test.local` (in .gitignore)
  - Load test secrets from file instead of hardcoding

- [ ] **Review all controllers for secret exposure**
  - Search for `process.env` usage
  - Ensure sensitive values not logged
  - Verify parameterized queries used

### Database Security

- [ ] **Enable SSL/TLS for database connection**
  Update `backend/config/db.js`:
  ```javascript
  const pool = new Pool({
    // ... existing config ...
    ssl: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      ca: fs.readFileSync(process.env.DB_SSL_CA),
      cert: fs.readFileSync(process.env.DB_SSL_CERT),
      key: fs.readFileSync(process.env.DB_SSL_KEY),
    },
  });
  ```

- [ ] **Add connection timeout security**
  ```javascript
  statement_timeout: 60000,
  idle_in_transaction_session_timeout: 30000,
  ```

- [ ] **Enable query logging for audit**
  ```javascript
  pool.on('query', (query) => {
    logger.debug('Query executed', { 
      text: query.text, 
      duration: query.duration 
    });
  });
  ```

### Redis Security

- [ ] **Set strong Redis password** (if not already done)
  ```bash
  # In redis.conf
  requirepass your_very_strong_password_here_32chars_minimum
  ```

- [ ] **Enable Redis TLS/SSL**
  ```bash
  # In redis.conf
  tls-port 6380
  tls-cert-file /path/to/redis.crt
  tls-key-file /path/to/redis.key
  tls-ca-cert-file /path/to/ca.crt
  ```

- [ ] **Update connection string**
  ```javascript
  const redisClient = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,  // Must be set
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
  ```

### Email Security

- [ ] **Use app-specific password (not regular password)**
  - For Gmail: Generate at myaccount.google.com/apppasswords
  - For other providers: Check their app password settings

- [ ] **Enable TLS/SSL in email config**
  ```javascript
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,  // 587 for TLS, 465 for SSL
    secure: process.env.EMAIL_SECURE !== 'false',
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
  ```

---

## 🔒 LONG-TERM HARDENING (Next Month)

### Secrets Management Infrastructure

- [ ] **Implement HashiCorp Vault or similar**
  ```bash
  # Install Vault
  # Enable KV v2 secrets engine
  vault secrets enable -version=2 kv
  
  # Store secrets
  vault kv put kv/chamasmart/jwt \
    secret_v1="new_secret_here" \
    secret_v2="backup_secret"
  
  # In application
  const vault = require('node-vault')({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  });
  ```

- [ ] **Or use cloud secrets manager**
  - AWS Secrets Manager
  - Azure Key Vault
  - Google Cloud Secret Manager

- [ ] **Implement automatic secret rotation**
  - Every 90 days
  - Gradual rollout
  - Zero-downtime deployment

### Audit & Monitoring

- [ ] **Enable comprehensive audit logging**
  ```javascript
  // Log every secret access
  logger.info('Secret accessed', {
    secretName: 'JWT_SECRET',
    user: req.user.id,
    timestamp: new Date(),
    context: 'token_generation',
  });
  ```

- [ ] **Set up security alerts**
  - Unauthorized secret access
  - Failed authentication attempts
  - Rate limit violations
  - Database errors

- [ ] **Configure log aggregation**
  - ELK Stack or similar
  - Real-time monitoring
  - Historical analysis
  - Compliance reporting

### Network Security

- [ ] **Implement network policies**
  - Database accessible only from backend
  - Redis accessible only from backend
  - Email SMTP over TLS
  - No plaintext protocols

- [ ] **Set up firewall rules**
  - Database: Port 5432 only from backend (restricted IP)
  - Redis: Port 6379 only from backend (restricted IP)
  - API: Port 5000 from load balancer only
  - HTTPS only: Port 443

- [ ] **Enable certificate pinning** (optional)
  ```javascript
  const https = require('https');
  const PinningAgent = require('https-pin-agent');
  
  const agent = new PinningAgent({
    pin: 'sha256/abcd1234...',  // Your cert hash
  });
  ```

### Testing & Validation

- [ ] **Add security tests**
  ```javascript
  test('JWT tokens cannot be forged', async () => {
    const forgedToken = jwt.sign(
      { id: 999, role: 'admin' },
      'wrong_secret'
    );
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(response.status).toBe(401);
  });
  ```

- [ ] **Run security audit regularly**
  ```bash
  npm audit
  npm audit fix
  npm outdated
  ```

- [ ] **Perform penetration testing**
  - Internal: Simulate attacker with code access
  - External: Simulate attacker with network access
  - Social: Test for phishing vulnerabilities

---

## ✅ VERIFICATION CHECKLIST

### Before Deployment

- [ ] No .env files committed to git
- [ ] All process.env variables defined
- [ ] No hardcoded secrets in code
- [ ] SSL/TLS enabled for DB
- [ ] SSL/TLS enabled for Redis
- [ ] Strong passwords used (32+ chars)
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Error handling doesn't expose secrets
- [ ] Logs don't contain sensitive data

### After Deployment

- [ ] All endpoints respond successfully
- [ ] Login/authentication works
- [ ] Rate limiting active
- [ ] Database queries succeed
- [ ] Redis cache works
- [ ] Email sending works (if configured)
- [ ] No error logs about missing env vars
- [ ] Monitoring alerts configured
- [ ] Log aggregation working
- [ ] Backup created and tested

---

## 🎯 SUCCESS METRICS

After completing this checklist, you should have:

| Metric | Before | After |
|--------|--------|-------|
| Secrets in git | YES ✗ | NO ✓ |
| Secrets in .gitignore | PARTIAL | COMPLETE ✓ |
| Database SSL/TLS | NO ✗ | YES ✓ |
| Redis SSL/TLS | NO ✗ | YES ✓ |
| Key rotation | NO ✗ | YES ✓ |
| Audit logging | PARTIAL | COMPLETE ✓ |
| Rate limiting | BASIC | ADVANCED ✓ |
| Password policy | BASIC | STRONG ✓ |
| Monitoring | NONE | COMPLETE ✓ |
| Documentation | NONE | COMPLETE ✓ |

---

## 📊 PROGRESS TRACKER

Print this section and fill it out as you complete tasks:

```
EMERGENCY (Today)
├─ [ ] Remove .env from git (15 min)
├─ [ ] Rotate secrets (30 min)
├─ [ ] Invalidate sessions (15 min)
├─ [ ] Change DB password (15 min)
└─ [ ] Verify functionality (15 min)
  → SUBTOTAL: 90 minutes

SHORT-TERM (This Week)
├─ [ ] Update .gitignore (15 min)
├─ [ ] Update tokenManager (30 min)
├─ [ ] Enable DB SSL/TLS (30 min)
├─ [ ] Enable Redis TLS (30 min)
├─ [ ] Secure test env (15 min)
└─ [ ] Add audit logging (30 min)
  → SUBTOTAL: 2.5 hours

LONG-TERM (This Month)
├─ [ ] Deploy Vault (2 hours)
├─ [ ] Auto key rotation (2 hours)
├─ [ ] Monitoring setup (3 hours)
├─ [ ] Security tests (2 hours)
└─ [ ] Penetration test (4 hours)
  → SUBTOTAL: 13 hours

TOTAL TIME: ~16.5 hours
```

---

## 🚨 RED FLAGS - Stop if You See These

❌ **Do NOT proceed to production if:**
1. .env file still in git
2. Secrets not rotated
3. Sessions not invalidated
4. Database password not changed
5. SSL/TLS not enabled
6. No audit logging
7. Rate limiting bypassed
8. Error logs expose secrets

---

## 📞 ESCALATION PROCEDURES

**If you encounter issues:**

1. **Secret generation fails**
   - Check Node.js crypto module: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Ensure sufficient entropy on system

2. **Git history removal fails**
   - Backup repo first (backup file created automatically)
   - Use manual git filter-branch if script fails
   - Contact git hosting provider if needed

3. **Database password change fails**
   - Verify PostgreSQL is running
   - Check user has proper permissions
   - Try connecting with new password separately

4. **Sessions don't clear**
   - Verify refresh_tokens table was truncated
   - Clear browser cookies/localStorage
   - Force logout from all client apps

5. **Backend won't start with new secrets**
   - Check all env vars are set
   - Verify secret format matches expected
   - Check logs for specific error messages
   - Rollback to previous version if critical

---

## 📚 QUICK REFERENCE

**Common Commands:**

```bash
# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Remove .env from git
node backend/scripts/remove-secrets-from-git.js

# Check .gitignore
git check-ignore -v .env

# Clear sessions
psql -U postgres -d chamasmart -c "TRUNCATE refresh_tokens CASCADE;"

# Test database connection
psql -U postgres -h localhost -d chamasmart -c "SELECT 1;"

# Check Redis
redis-cli ping

# View logs
tail -f backend/logs/production.log

# Health check
curl http://localhost:5000/api/health
```

---

## 🎓 LEARNING RESOURCES

1. **OWASP API Security Top 10**
   https://owasp.org/www-project-api-security/

2. **12 Factor App - Config**
   https://12factor.net/config

3. **Node.js Security Checklist**
   https://nodejs.org/en/docs/guides/security/

4. **Express.js Best Practices**
   https://expressjs.com/en/advanced/best-practice-security.html

5. **Secrets Management**
   https://hashicorp.com/blog/why-we-need-dynamic-secrets/

---

**Last Updated:** January 18, 2026  
**Status:** Ready for implementation  
**Priority:** 🔴 CRITICAL - Complete before any production deployment

✅ **Begin with emergency fix immediately** ✅
