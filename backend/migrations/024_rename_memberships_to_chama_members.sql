-- Migration: 024_rename_memberships_to_chama_members.sql
-- Safe idempotent version — base schema already creates chama_members directly.
-- All RENAME operations are skipped since table/indexes already have correct names.

-- Ensure critical columns for ROSCA exist
ALTER TABLE chama_members 
ADD COLUMN IF NOT EXISTS rotation_position INTEGER;

ALTER TABLE chama_members
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE chama_members
ADD COLUMN IF NOT EXISTS join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE chama_members
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Attach/Fix updated_at trigger (safe to recreate)
DROP TRIGGER IF EXISTS trigger_chama_members_updated_at ON chama_members;
CREATE TRIGGER trigger_chama_members_updated_at
    BEFORE UPDATE ON chama_members
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

DO $$
BEGIN
    RAISE NOTICE '✅ chama_members schema verified successfully';
END $$;
