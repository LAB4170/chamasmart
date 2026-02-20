-- Migration: 028_chama_governance_fields.sql
-- Purpose: Add fields to support dual-official approval for Chama deletion
-- Author: Senior Database Engineer

BEGIN;

-- 1. Add fields for deletion handshake
ALTER TABLE IF EXISTS chamas 
ADD COLUMN IF NOT EXISTS deletion_requested_by INTEGER REFERENCES users(user_id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Add comments
COMMENT ON COLUMN chamas.deletion_requested_by IS 'User ID of the official who initiated the deletion request';
COMMENT ON COLUMN chamas.deletion_requested_at IS 'Timestamp when the deletion request was initiated';

-- 3. Update Audit Logs Type (ensure 'GOVERNANCE' type is recognized or just documented)
-- No table changes needed for log types as they are strings, but we document intent.

COMMIT;
