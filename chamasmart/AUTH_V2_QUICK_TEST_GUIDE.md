# 🧪 Auth V2 Quick Testing Guide

## SETUP (5 minutes)

### 1. Start Backend

```bash
cd backend
npm run dev
# Should see: "STABILIZED: Server running on port 5005"
```

### 2. Start Frontend

```bash
# In another terminal
cd frontend
npm run dev
# Should see: "Local: http://localhost:5173"
```

### 3. Check Services

**Backend Health:**

```bash
curl http://localhost:5005/api/auth/v2/health
```

Expected: `{"success":true,"message":"Auth service is operational"}`

**Database Connection:**

```bash
# Backend will auto-connect to PostgreSQL on startup
# Check logs for "✅ Database connected"
```

**Redis Connection:**

```bash
# Check logs for "✅ Redis connected"
# Or test directly:
redis-cli ping
# Expected: PONG
```

---

## SCENARIO 1: Email OTP Signup (10 minutes)

### Step 1: Start Signup

```bash
curl -X POST http://localhost:5005/api/auth/v2/signup/start \
  -H "Content-Type: application/json" \
  -d '{
    "authMethod": "email",
    "email": "john@example.com",
    "name": "John Doe"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "OTP sent to j***@example.com",
  "data": {
    "signupToken": "abc123def456...",
    "expiresIn": 600,
    "contact": "j***@example.com"
  }
}
```

### Step 2: Get OTP from Redis (Dev Only)

In Redis CLI:

```bash
redis-cli
> GET signup:abc123def456...
> # Returns: {"email":"john@example.com","otp":"123456","otpExpiry":"..."}
```

**OR** Check email in development:

- In development mode, OTP is logged to console
- Look for: `📧 OTP Email sent`

### Step 3: Verify OTP

```bash
curl -X POST http://localhost:5005/api/auth/v2/signup/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "signupToken": "abc123def456...",
    "otp": "123456",
    "password": "MySecurePass123!"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "userId": 1,
      "email": "john@example.com",
      "phone": null,
      "name": "John Doe"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 3600
    }
  }
}
```

### Step 4: Use Access Token

```bash
curl -X GET http://localhost:5005/api/auth/v2/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## SCENARIO 2: Phone OTP Signup (8 minutes)

```bash
# Step 1: Start signup
curl -X POST http://localhost:5005/api/auth/v2/signup/start \
  -H "Content-Type: application/json" \
  -d '{
    "authMethod": "phone",
    "phone": "712345678",
    "name": "Jane Smith"
  }'
```

**Expected:** Similar to email, but `contact` will be `+254712****78`

```bash
# Step 2: Get OTP from Redis (same process as email)
redis-cli
> GET signup:<signupToken>
```

```bash
# Step 3: Verify OTP (same endpoint as email)
curl -X POST http://localhost:5005/api/auth/v2/signup/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "signupToken": "...",
    "otp": "123456",
    "password": "MyPass123!"
  }'
```

---

## SCENARIO 3: Resend OTP (2 minutes)

```bash
# After signup started, but OTP lost/expired
curl -X POST http://localhost:5005/api/auth/v2/signup/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "signupToken": "abc123def456..."
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "OTP resent successfully",
  "data": {
    "expiresIn": 600
  }
}
```

**Note:** Rate limited to 1 resend per 30 seconds

- Try to resend twice in 20 seconds → 2nd fails with 429 (Too Many Requests)

---

## SCENARIO 4: API Key Management (5 minutes)

### Create API Key

```bash
# Need valid JWT token from previous signup
curl -X POST http://localhost:5005/api/auth/v2/api-keys \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App Integration",
    "expiresInDays": 365
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "API key created successfully",
  "data": {
    "keyId": "key-12345",
    "name": "Mobile App Integration",
    "apiKey": "chama_live_550e8400_e29b41d4",
    "keyPrefix": "chama_live_550e84",
    "expiresAt": "2026-01-18T...",
    "createdAt": "2025-01-18T...",
    "warning": "Save your API key now. You will not be able to see it again."
  }
}
```

### List API Keys

```bash
curl -X GET http://localhost:5005/api/auth/v2/api-keys \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

### Use API Key for Authentication

```bash
# Use the API key like a bearer token
curl -X GET http://localhost:5005/api/auth/v2/profile \
  -H "Authorization: Bearer chama_live_550e8400_e29b41d4"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "userId": 1,
    "email": "john@example.com",
    "authenticatedVia": "api-key"
  }
}
```

### Revoke API Key

```bash
curl -X DELETE http://localhost:5005/api/auth/v2/api-keys/key-12345/revoke \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

---

## SCENARIO 5: Token Refresh (3 minutes)

```bash
# Using the refreshToken from signup
curl -X POST http://localhost:5005/api/auth/v2/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

---

## SCENARIO 6: Rate Limiting (5 minutes)

### Test Signup Rate Limit (5 attempts per hour)

```bash
for i in {1..6}; do
  curl -X POST http://localhost:5005/api/auth/v2/signup/start \
    -H "Content-Type: application/json" \
    -d "{
      \"authMethod\": \"email\",
      \"email\": \"test${i}@example.com\",
      \"name\": \"Test User ${i}\"
    }"
  echo "\n--- Attempt $i ---\n"
done
```

**Expected:**

- Attempts 1-5: Status 200 (success)
- Attempt 6: Status 429 (rate limited)

```json
{
  "success": false,
  "message": "Too many signup attempts. Please try again after 1 hour.",
  "retryAfter": 3600
}
```

### Test OTP Resend Rate Limit (1 per 30 seconds)

```bash
# Immediately after first resend
curl -X POST http://localhost:5005/api/auth/v2/signup/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"signupToken": "..."}'

# Then try again in 10 seconds (should fail)
sleep 10
curl -X POST http://localhost:5005/api/auth/v2/signup/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"signupToken": "..."}'
```

---

## SCENARIO 7: Frontend Testing (10 minutes)

### Visit Signup Page

1. Open browser: `http://localhost:5173/signup-v2`
2. Should see:
   - ✅ ChamaSmart header
   - ✅ 4-step progress bar
   - ✅ Account type selection (3 cards)

### Step 1: Select Account Type

- Click "Join Existing Group"
- Progress bar updates
- "Continue" button enabled

### Step 2: Select Auth Method

- Click "Email Verification"
- Email input appears
- Type: `frontend-test@example.com`
- Click "Get Verification Code"
- Should see success message

### Step 3: Verify OTP

- Should auto-navigate to OTP form
- See masked email: `f***@example.com`
- Get OTP from Redis or logs
- Enter 6 digits (auto-focus between inputs)
- Optional: Enter password
- Click "Verify & Create Account"

### Step 4: Complete Profile

- Enter first/last name
- Phone (optional)
- Check "I agree to..."
- Click "Get Started"
- Should redirect to dashboard

---

## ERROR SCENARIOS & DEBUGGING

### Error 1: OTP Invalid

```json
{
  "success": false,
  "message": "Invalid or expired OTP",
  "status": 401
}
```

**Fix:** Get fresh OTP from Redis or resend

### Error 2: Signup Token Expired

```json
{
  "success": false,
  "message": "Signup session expired. Please start over.",
  "status": 410
}
```

**Fix:** Start signup again (tokens expire in 15 minutes)

### Error 3: Rate Limited

```json
{
  "success": false,
  "message": "Too many signup attempts. Please try again after 1 hour.",
  "retryAfter": 3600,
  "status": 429
}
```

**Fix:** Wait 1 hour, or restart Redis in development

### Error 4: Database Connection Failed

**Logs:** `❌ Database connection failed`
**Fix:**

- Verify PostgreSQL is running: `psql -U postgres`
- Check credentials in `.env`
- Verify DB exists: `createdb chamasmart`

### Error 5: Redis Connection Failed

**Logs:** `❌ Redis connection failed`
**Fix:**

- Verify Redis is running: `redis-cli ping` → should return `PONG`
- Check Redis credentials in `.env`
- Default: `localhost:6379` (no password in dev)

---

## DEBUGGING COMMANDS

### View All OTP Data in Redis

```bash
redis-cli
> KEYS signup:*
> GET signup:<token>
```

### View All API Keys

```bash
psql -U postgres -d chamasmart -c "SELECT * FROM api_keys;"
```

### View OTP Audit Log

```bash
psql -U postgres -d chamasmart -c "SELECT * FROM otp_audit ORDER BY created_at DESC LIMIT 10;"
```

### View Signup Sessions

```bash
psql -U postgres -d chamasmart -c "SELECT * FROM signup_sessions;"
```

### Tail Backend Logs

```bash
tail -f backend/logs/app.log | grep -i "auth\|otp\|signup"
```

### Reset Rate Limits (Dev Only)

```bash
redis-cli
> FLUSHDB
# Or specific:
> KEYS rate-limit:*
> DEL <key1> <key2> ...
```

---

## POSTMAN COLLECTION

Save as `auth-v2.postman_collection.json`:

```json
{
  "info": {
    "name": "ChamaSmart Auth V2",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Signup - Email Start",
      "request": {
        "method": "POST",
        "url": "http://localhost:5005/api/auth/v2/signup/start",
        "body": {
          "mode": "raw",
          "raw": "{\"authMethod\":\"email\",\"email\":\"{{$randomEmail}}\",\"name\":\"Test User\"}"
        }
      }
    },
    {
      "name": "2. Signup - Verify OTP",
      "request": {
        "method": "POST",
        "url": "http://localhost:5005/api/auth/v2/signup/verify-otp",
        "body": {
          "mode": "raw",
          "raw": "{\"signupToken\":\"{{signupToken}}\",\"otp\":\"123456\",\"password\":\"TestPass123!\"}"
        }
      }
    },
    {
      "name": "3. Refresh Token",
      "request": {
        "method": "POST",
        "url": "http://localhost:5005/api/auth/v2/refresh-token",
        "body": {
          "mode": "raw",
          "raw": "{\"refreshToken\":\"{{refreshToken}}\"}"
        }
      }
    },
    {
      "name": "4. Create API Key",
      "request": {
        "method": "POST",
        "url": "http://localhost:5005/api/auth/v2/api-keys",
        "header": { "Authorization": "Bearer {{accessToken}}" },
        "body": {
          "mode": "raw",
          "raw": "{\"name\":\"Test Key\",\"expiresInDays\":365}"
        }
      }
    }
  ]
}
```

---

## TIMELINE & SUCCESS CRITERIA

**✅ All Tests Pass When:**

1. ✅ Email signup creates user in DB
2. ✅ OTP is generated and stored (verified in Redis)
3. ✅ OTP verification creates user, generates tokens
4. ✅ Tokens can refresh
5. ✅ API keys can be created and used for auth
6. ✅ Rate limiting blocks after thresholds
7. ✅ Frontend form works end-to-end

---

**NOW READY FOR PHASE 3: Frontend Integration Testing**
