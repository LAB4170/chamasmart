-- Migration: 030_fix_chama_meeting_day_size.sql
-- Purpose: Increase size of meeting_day column

ALTER TABLE chamas 
ALTER COLUMN meeting_day TYPE VARCHAR(100);
