-- Migration: 029_fix_chama_creation_schema.sql
-- Purpose: Fix chama_type constraints and missing invite_code column

ALTER TABLE chamas 
DROP CONSTRAINT IF EXISTS chamas_chama_type_check;

ALTER TABLE chamas 
ADD CONSTRAINT chamas_chama_type_check 
CHECK (chama_type IN ('CHAMA', 'ROSCA', 'ASCA', 'TABLE_BANKING', 'WELFARE'));

ALTER TABLE chamas 
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;

COMMENT ON COLUMN chamas.invite_code IS 'Unique 6-8 character code for joining the chama directly';
