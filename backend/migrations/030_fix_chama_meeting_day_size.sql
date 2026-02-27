-- Migration: 030_fix_chama_meeting_day_size.sql
-- Purpose: Increase size of meeting_day column to accommodate detailed descriptions
-- Author: Antigravity

BEGIN;

ALTER TABLE chamas 
ALTER COLUMN meeting_day TYPE VARCHAR(100);

COMMIT;
