-- Migration: Fix Notifications Schema Mismatch
-- Aligns database with notifications.js utility

-- 1. Rename related_id to entity_id to match code
ALTER TABLE notifications 
RENAME COLUMN related_id TO entity_id;

-- 2. Add missing columns expected by notifications.js
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Add index for entity lookups
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

DO $$
BEGIN
    RAISE NOTICE '✅ Notifications schema updated successfully';
END $$;
