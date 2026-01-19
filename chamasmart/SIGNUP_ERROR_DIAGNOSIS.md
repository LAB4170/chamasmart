# 🔴 Signup 500 Error - Diagnosis & Fixes

## Root Causes Identified

### 1. **Database Connection Issue** ⚠️
- PostgreSQL might not be running
- Credentials in `.env` might be incorrect
- Database user/password mismatch

### 2. **Missing Database Migration** ⚠️
- Migration `017_auth_redesign.sql` not applied
- Tables: `users`, `signup_sessions`, `refresh_tokens`, `otp_audit`, `api_keys` might not exist

### 3. **Redis Connection Failure** ⚠️
- Redis server not running on localhost:6379
- Rate limiting middleware fails silently and causes 500

### 4. **Missing Environment Variables** ⚠️
- `.env` file not created or missing critical variables
- JWT_SECRET, DB credentials not set

---

## Step-by-Step Fix

### Step 1: Verify PostgreSQL is Running
```bash
# Windows - Check if PostgreSQL service is running
Get-Service PostgreSQL* | Format-Table Name, Status

# If not running, start it
Start-Service PostgreSQL15  # Adjust version number as needed

# Test connection
psql -U postgres -h localhost -p 5432
```

### Step 2: Verify Redis is Running
```bash
# Windows - Check Redis
Get-Service Redis* | Format-Table Name, Status

# If not running, start it via Redis CLI or Docker
# Or install: https://github.com/microsoftarchive/redis/releases
```

### Step 3: Configure Environment Variables
```bash
cd backend
cp .env.example .env

# Edit .env and verify these are set:
cat .env | grep -E "DB_|REDIS_|JWT_"
```

### Step 4: Apply Database Migration
```bash
cd backend
npm run migrate

# If migrate command doesn't exist, run manually:
# psql -U your_db_user -d your_database -f migrations/017_auth_redesign.sql
```

### Step 5: Clear Cache and Restart
```bash
cd backend
# Clear node_modules cache
npm cache clean --force

# Reinstall dependencies
rm -r node_modules package-lock.json
npm install

# Restart backend
npm run dev
```

---

## Error Identification Guide

### If you see this error:
```
Error connecting to PostgreSQL (will retry)
password authentication failed
```
**Fix**: Update DB_USER and DB_PASSWORD in `.env`

### If you see:
```
ECONNREFUSED 127.0.0.1:5432
```
**Fix**: Start PostgreSQL service or check if port 5432 is correct

### If you see:
```
Cannot find table 'users'
```
**Fix**: Run migrations with `npm run migrate`

### If you see:
```
ECONNREFUSED 127.0.0.1:6379
```
**Fix**: Start Redis service on port 6379

---

## Quick Health Check

Run these commands in backend directory:

```bash
# 1. Check environment variables
node -e "console.log({db: process.env.DB_USER, redis: process.env.REDIS_HOST, jwt: process.env.JWT_SECRET ? 'SET' : 'MISSING'})"

# 2. Test database connection
node -e "const db = require('./config/db'); db.query('SELECT NOW()', (err, result) => { console.log(err ? 'DB ERROR: '+err.message : 'DB OK'); process.exit(0); })"

# 3. Test Redis connection
node -e "const redis = require('./config/redis'); redis.ping((err, reply) => { console.log(err ? 'REDIS ERROR: '+err.message : 'REDIS OK'); process.exit(0); })"
```

---

## Recommended Debug Setup

Add detailed error logging to authControllerV2.js:

```javascript
const signupStart = async (req, res, next) => {
  console.log('🔍 SIGNUP START CALLED', { body: req.body });
  console.log('🔍 Environment:', { 
    dbUser: process.env.DB_USER, 
    hasJWTSecret: !!process.env.JWT_SECRET 
  });
  
  try {
    // ... rest of function
  } catch (error) {
    console.error('🚨 SIGNUP ERROR:', error);
    console.error('🚨 ERROR STACK:', error.stack);
    next(error);
  }
};
```

---

## Next Steps

1. ✅ Check PostgreSQL is running
2. ✅ Check Redis is running  
3. ✅ Verify .env is configured
4. ✅ Apply database migration
5. ✅ Restart backend: `npm run dev`
6. ✅ Test signup again at http://localhost:5173/signup-v2

