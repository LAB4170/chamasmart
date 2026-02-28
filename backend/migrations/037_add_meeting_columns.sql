-- Migration: Add missing columns to meetings table
-- Purpose: Fixes the 500 internal server error when fetching meetings by adding missing schema definitions.

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(50) DEFAULT 'PHYSICAL',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Optional trigger to auto-update updated_at if you have an updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_meetings_modtime ON meetings;
CREATE TRIGGER update_meetings_modtime
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
