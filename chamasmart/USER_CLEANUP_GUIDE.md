# User Cleanup & Fresh Start Guide

## Overview

This guide will help you delete all existing user accounts and reset the database to start fresh with new user registrations. All MongoDB references have also been removed.

---

## ✅ What's Included

### 1. **Cleanup Script**

- Location: `backend/scripts/cleanup_users.js`
- Automatically deletes all users, chamas, contributions, loans, and related data
- Resets ID sequences so new users start from ID 1
- Includes comprehensive logging

### 2. **Migration File**

- Location: `backend/migrations/011_cleanup_users_fresh_start.sql`
- SQL-based cleanup for manual execution in pgAdmin if needed

### 3. **MongoDB Removal**

- ✅ Removed `express-mongo-sanitize` from `package.json`
- ✅ No MongoDB imports found in codebase
- ✅ 100% PostgreSQL only

---

## 🚀 How to Use

### **Option A: Using the Cleanup Script (Recommended)**

```bash
cd backend
node scripts/cleanup_users.js
```

**Output:**

```
🧹 Starting cleanup...

📊 Found 5 users to delete
📊 Found 3 chamas
📊 Found 15 contributions
✅ Deleted all audit logs
✅ Deleted all notifications
✅ Deleted all welfare data
✅ Deleted all loan repayments
✅ Deleted all loans
✅ Deleted all payouts
✅ Deleted all ROSCA data
✅ Deleted all ASCA data
✅ Deleted all meetings
✅ Deleted all contributions
✅ Deleted all proposals
✅ Deleted all join requests
✅ Deleted all chama invites
✅ Deleted all chama members
✅ Deleted all chamas
✅ Deleted 5 users
✅ Reset ID sequences

✨ Cleanup completed successfully!
📝 Database is now ready for fresh user registration.
```

---

### **Option B: Using pgAdmin (Manual)**

1. Open **pgAdmin** and connect to your PostgreSQL database
2. Right-click on your database → **Query Tool**
3. Copy-paste the contents of `backend/migrations/011_cleanup_users_fresh_start.sql`
4. Click **Execute**

---

### **Option C: Using SQL Command Line**

```bash
psql -U postgres -d chamasmart -f backend/migrations/011_cleanup_users_fresh_start.sql
```

---

## 📋 What Gets Deleted

When you run the cleanup, the following data is removed:

| Table                     | Records Deleted           |
| ------------------------- | ------------------------- |
| `audit_logs`              | All audit entries         |
| `notifications`           | All notifications         |
| `welfare_claim_approvals` | All welfare approvals     |
| `welfare_claims`          | All welfare claims        |
| `welfare_contributions`   | All welfare contributions |
| `loan_repayments`         | All loan repayments       |
| `loans`                   | All loans                 |
| `payouts`                 | All payouts               |
| `rosca_payouts`           | All ROSCA payouts         |
| `rosca_members`           | All ROSCA members         |
| `asca_cycles`             | All ASCA cycles           |
| `asca_members`            | All ASCA members          |
| `meetings`                | All meetings              |
| `contributions`           | All contributions         |
| `proposals`               | All proposals             |
| `join_requests`           | All join requests         |
| `chama_invites`           | All chama invites         |
| `chama_members`           | All chama members         |
| `chamas`                  | All chamas                |
| `users`                   | **All users**             |

**ID Sequences Reset:**

- `users_user_id_seq` → Starts at 1
- `chamas_chama_id_seq` → Starts at 1
- `contributions_contribution_id_seq` → Starts at 1
- Plus other sequences...

---

## ⚠️ Important Notes

### **This is Permanent!**

- There is **NO undo**. Once you run the cleanup, all user data is gone.
- Make sure you have a backup if you need to preserve any data.

### **Use Only for Development**

- ✅ Local development
- ✅ Testing environments
- ✅ Staging (if needed)
- ❌ **NEVER** in production!

### **After Cleanup**

1. Users will have ID starting from 1
2. Next user registration will get `user_id = 1`
3. All chama IDs will reset
4. All contributions will be cleared
5. Fresh start guaranteed!

---

## 🧪 Verify Cleanup Was Successful

Run these queries in pgAdmin to verify:

```sql
-- Check user count
SELECT COUNT(*) FROM users;
-- Expected: 0

-- Check chama count
SELECT COUNT(*) FROM chamas;
-- Expected: 0

-- Check next user ID
SELECT nextval('users_user_id_seq');
-- Expected: 1
```

---

## 📝 MongoDB References Removed

The following MongoDB dependency has been removed:

- ✅ `express-mongo-sanitize` → Deleted from `package.json`

**System is now 100% PostgreSQL based.**

---

## 🔄 Recovery Steps

If something goes wrong:

1. **Rollback if in transaction:**

   ```sql
   ROLLBACK;
   ```

2. **From backup** (if available):

   - Restore from your PostgreSQL backup
   - `pg_restore backup.sql`

3. **Contact Support:**
   - Check logs in `backend/logs/`
   - Verify database connection in `.env`

---

## ✨ Next Steps

After cleanup:

1. Restart your backend server
2. Create new test users via registration endpoint
3. Verify IDs start from 1
4. Continue development!

```bash
# Terminal 1: Start docker-compose (if using containers)
docker-compose up

# Terminal 2: Verify backend is running
curl http://localhost:5000/api/health

# Terminal 3: Register a new test user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "password": "password123",
    "phone_number": "+254712345678"
  }'
```

---

## 📞 Questions?

If you encounter any issues:

1. Check the logs: `backend/logs/chamasmart.log`
2. Verify database is running
3. Ensure you have PostgreSQL permissions
4. Check your `.env` file has correct credentials

---

**Last Updated:** 2026-01-16
**Status:** ✅ Ready for use
