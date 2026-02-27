-- Migration: 031_fix_is_active_defaults.sql
-- Purpose: Set default values for is_active columns and fix existing NULLs
-- Author: Antigravity

BEGIN;

-- Fix chamas table
ALTER TABLE chamas ALTER COLUMN is_active SET DEFAULT true;
UPDATE chamas SET is_active = true WHERE is_active IS NULL;

-- Fix chama_members table
ALTER TABLE chama_members ALTER COLUMN is_active SET DEFAULT true;
UPDATE chama_members SET is_active = true WHERE is_active IS NULL;

COMMIT;
