-- Migration: 024_rename_memberships_to_chama_members.sql
-- Purpose: Standardize on chama_members table name to match backend code
-- Author: Antigravity

BEGIN;

-- 1. Rename the table
ALTER TABLE IF EXISTS memberships RENAME TO chama_members;

-- 2. Rename the primary key constraint if it exists
ALTER TABLE IF EXISTS chama_members 
RENAME CONSTRAINT memberships_pkey TO chama_members_pkey;

-- 3. Rename foreign key constraints for consistency
ALTER TABLE IF EXISTS chama_members
RENAME CONSTRAINT memberships_chama_id_fkey TO chama_members_chama_id_fkey;

ALTER TABLE IF EXISTS chama_members
RENAME CONSTRAINT memberships_user_id_fkey TO chama_members_user_id_fkey;

-- 4. Rename indexes for consistency
ALTER INDEX IF EXISTS idx_memberships_user_id RENAME TO idx_chama_members_user_id;
ALTER INDEX IF EXISTS idx_memberships_chama_id RENAME TO idx_chama_members_chama_id;
ALTER INDEX IF EXISTS idx_memberships_status RENAME TO idx_chama_members_status;
ALTER INDEX IF EXISTS idx_memberships_role RENAME TO idx_chama_members_role;
ALTER INDEX IF EXISTS idx_memberships_user_chama RENAME TO idx_chama_members_user_chama;
ALTER INDEX IF EXISTS idx_memberships_chama_active RENAME TO idx_chama_members_chama_active;
ALTER INDEX IF EXISTS idx_memberships_user_active RENAME TO idx_chama_members_user_active;
ALTER INDEX IF EXISTS idx_memberships_officials RENAME TO idx_chama_members_officials;

-- 5. Ensure critical columns for ROSCA exist (from fix_db_schema.js logic)
ALTER TABLE chama_members 
ADD COLUMN IF NOT EXISTS rotation_position INTEGER;

ALTER TABLE chama_members
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE chama_members
ADD COLUMN IF NOT EXISTS join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE chama_members
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. Attach/Fix updated_at trigger
DROP TRIGGER IF EXISTS trigger_chama_members_updated_at ON chama_members;
CREATE TRIGGER trigger_chama_members_updated_at
    BEFORE UPDATE ON chama_members
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at(); -- Using existing timestamp function

COMMIT;
