-- Migration: 029_fix_chama_creation_schema.sql
-- Purpose: Fix chama_type constraints and missing invite_code column
-- Author: Antigravity

BEGIN;

-- 1. Update chama_type check constraint
ALTER TABLE chamas 
DROP CONSTRAINT IF EXISTS chamas_chama_type_check;

ALTER TABLE chamas 
ADD CONSTRAINT chamas_chama_type_check 
CHECK (chama_type IN ('CHAMA', 'ROSCA', 'ASCA', 'TABLE_BANKING', 'WELFARE'));

-- 2. Add missing invite_code column to chamas table
-- Some controllers expect it directly on the chama for quick lookup
ALTER TABLE chamas 
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;

-- 3. Add comment
COMMENT ON COLUMN chamas.invite_code IS 'Unique 6-8 character code for joining the chama directly';

COMMIT;
