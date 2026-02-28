-- Migration: Add link column to notifications table
-- This column is expected by both common notification utility and front-end UI

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS link VARCHAR(500);

-- Also ensure entity_type and entity_id exist as back-up
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS entity_id INTEGER;

DO $$
BEGIN
    RAISE NOTICE '✅ Notifications table updated with link column';
END $$;
