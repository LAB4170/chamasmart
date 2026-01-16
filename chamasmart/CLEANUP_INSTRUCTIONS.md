# 🧹 Quick Cleanup - Step by Step

## Summary of Changes Made

✅ **Created 3 new files:**
1. `backend/scripts/cleanup_users.js` - Automated cleanup script
2. `backend/migrations/011_cleanup_users_fresh_start.sql` - SQL migration
3. `USER_CLEANUP_GUIDE.md` - Complete documentation

✅ **Modified 1 file:**
1. `backend/package.json` - Removed `express-mongo-sanitize` (MongoDB sanitizer)

✅ **Changes verified:**
- No MongoDB imports found in codebase
- 100% PostgreSQL only

---

## 🚀 Run Cleanup Now

### **Step 1: Stop Current Backend (if running)**
```bash
# If backend is running in terminal, press Ctrl+C
```

### **Step 2: Run Cleanup Script**
```bash
cd c:\Users\lewis\Desktop\chamasmart\backend
node scripts/cleanup_users.js
```

**Expected Output:**
```
🧹 Starting cleanup...

📊 Found X users to delete
📊 Found X chamas
📊 Found X contributions
✅ Deleted all audit logs
✅ Deleted all notifications
[... more deletions ...]
✅ Deleted X users
✅ Reset ID sequences

✨ Cleanup completed successfully!
📝 Database is now ready for fresh user registration.
```

### **Step 3: Reinstall Dependencies (Optional but Recommended)**
```bash
npm install
```

### **Step 4: Restart Backend**
```bash
# Using Docker (recommended)
docker-compose up

# OR locally
npm run dev
```

### **Step 5: Verify Fresh Start**
```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Register first new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Fresh",
    "last_name": "Start",
    "email": "newuser@example.com",
    "password": "password123",
    "phone_number": "+254712345678"
  }'
```

---

## 📊 Database State After Cleanup

**All users deleted:**
- User count: 0
- Next user_id: 1 (will start fresh)

**All related data cleared:**
- ✅ Chamas: Deleted
- ✅ Contributions: Deleted
- ✅ Loans: Deleted
- ✅ Payouts: Deleted
- ✅ Meetings: Deleted
- ✅ Join requests: Deleted
- ✅ Invites: Deleted
- ✅ Audit logs: Deleted
- ✅ Notifications: Deleted

---

## 🔧 Alternative Methods

### **If Node script fails, use pgAdmin:**
1. Open pgAdmin
2. Right-click database → Query Tool
3. Run `backend/migrations/011_cleanup_users_fresh_start.sql`

### **Or use SQL CLI:**
```bash
psql -U postgres -d chamasmart -f backend/migrations/011_cleanup_users_fresh_start.sql
```

---

## ✨ You're All Set!

Everything is ready. Just run the cleanup script and you'll have a fresh database for testing new user registration!

---

**Need help?** Check `USER_CLEANUP_GUIDE.md` for detailed documentation.
