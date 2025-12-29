# Database Migration Instructions

## Issue: CREATE INDEX CONCURRENTLY Error

If you see this error:
```
ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
SQL state: 25001
```

This happens because pgAdmin runs queries inside a transaction by default, and `CONCURRENTLY` cannot be used in transactions.

---

## Solution: Use the pgAdmin-Compatible Migration

### Step 1: Open pgAdmin

1. Launch pgAdmin
2. Connect to your PostgreSQL server
3. Navigate to your `chamasmart` database

### Step 2: Disable Auto-Commit (Important!)

pgAdmin needs to run this migration **outside** of a transaction:

1. In the Query Tool, go to the menu bar
2. Click **Query** → **Auto commit?** (make sure it's checked/enabled)
   - OR look for the "Auto commit" toggle button in the toolbar

### Step 3: Run the Migration

1. Click **Tools** → **Query Tool**
2. Click the **Open File** icon (folder icon)
3. Navigate to: `backend/migrations/007_performance_optimization_pgadmin.sql`
4. Click **Execute** (F5 or the play button)

### Step 4: Verify Success

You should see messages like:
```
CREATE INDEX
CREATE INDEX
...
CREATE MATERIALIZED VIEW
CREATE FUNCTION
ANALYZE
Query returned successfully
```

### Step 5: Refresh Materialized Views

Run this query to populate the statistics:

```sql
SELECT refresh_all_statistics();
```

---

## Alternative: Command Line (If Available)

If you have `psql` installed, you can run:

```bash
psql -U postgres -d chamasmart -f backend/migrations/007_performance_optimization_pgadmin.sql
```

---

## Verify Migration Success

Run these queries to confirm everything was created:

```sql
-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('contributions', 'chamas', 'chama_members', 'loans')
ORDER BY tablename, indexname;

-- Check materialized views
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE matviewname LIKE 'mv_%';

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE 'refresh%';
```

Expected results:
- **15+ indexes** created
- **2 materialized views**: `mv_chama_statistics`, `mv_user_statistics`
- **3 functions**: `refresh_chama_statistics`, `refresh_user_statistics`, `refresh_all_statistics`

---

## What's Different in the pgAdmin Version?

The `007_performance_optimization_pgadmin.sql` file:
- ✅ Removed `CONCURRENTLY` keyword from `CREATE INDEX` statements
- ✅ Works inside pgAdmin's transaction handling
- ⚠️ **Note**: Index creation will briefly lock tables (usually <1 second for small databases)

For production databases with millions of records, consider:
1. Running during off-peak hours
2. Using the original `007_performance_optimization.sql` with `psql` command line
3. Creating indexes one at a time with `CONCURRENTLY` outside transactions

---

## Troubleshooting

### Error: "relation already exists"
This means some objects were already created. It's safe to ignore or you can:
```sql
-- Drop and recreate
DROP MATERIALIZED VIEW IF EXISTS mv_chama_statistics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_user_statistics CASCADE;
-- Then run the migration again
```

### Error: "column does not exist"
Make sure you've run all previous migrations (001-006) first:
```bash
ls backend/migrations/
# Should see: 001_add_soft_deletes.sql through 006_performance_indexes.sql
```

### Performance Issues During Migration
If index creation takes too long:
1. Stop the query (red stop button)
2. Run indexes one at a time
3. Monitor progress with: `SELECT * FROM pg_stat_progress_create_index;`

---

## Post-Migration

### Schedule Hourly Refresh (Optional)

To keep statistics up-to-date, schedule this query to run every hour:

```sql
SELECT refresh_all_statistics();
```

Options:
- **pg_cron** extension (if available)
- **Node.js cron job** (add to `scheduler.js`)
- **External cron/Task Scheduler**

### Monitor Performance

Check slow query logs:
```bash
tail -f backend/logs/combined-*.log | grep "Slow"
```

---

## Need Help?

If you encounter any issues:
1. Check the error message carefully
2. Verify you're connected to the correct database
3. Ensure you have CREATE privilege
4. Try running statements one at a time to isolate the issue
