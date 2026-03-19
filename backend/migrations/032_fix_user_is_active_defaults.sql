-- Migration: 032_fix_user_is_active_defaults.sql
-- Purpose: Set default value for is_active in users table and fix existing NULLs

-- 1. Update existing nulls to true
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- 2. Set default to true for future registrations
ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;

-- Log success
DO $$
BEGIN
    RAISE NOTICE '✅ Users is_active defaults fixed successfully';
END $$;
