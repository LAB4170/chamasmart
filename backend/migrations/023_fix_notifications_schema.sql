-- Migration: Fix Notifications Schema Mismatch (safe idempotent version)
-- The base schema already creates notifications with entity_id.
-- This migration ensures entity_type, entity_id, and metadata columns exist.

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS entity_id INTEGER;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add index for entity lookups (safe if already exists)
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

DO $$
BEGIN
    RAISE NOTICE '✅ Notifications schema verified/updated successfully';
END $$;
