-- Migration: 025_fix_chama_members_columns.sql
-- Purpose: Add missing columns to chama_members table to fix SQL errors
-- Author: Antigravity

BEGIN;

-- 1. Add missing columns to chama_members
ALTER TABLE IF EXISTS chama_members 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE IF EXISTS chama_members 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE IF EXISTS chama_members 
ADD COLUMN IF NOT EXISTS join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE IF EXISTS chama_members 
ADD COLUMN IF NOT EXISTS rotation_position INTEGER;

-- 2. Ensure total_members exists in chamas (referenced in some logic)
ALTER TABLE IF EXISTS chamas
ADD COLUMN IF NOT EXISTS total_members INTEGER DEFAULT 0;

COMMIT;
