-- Migration: 028_chama_governance_fields.sql
-- Purpose: Add fields to support dual-official approval for Chama deletion

ALTER TABLE IF EXISTS chamas 
ADD COLUMN IF NOT EXISTS deletion_requested_by INTEGER REFERENCES users(user_id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN chamas.deletion_requested_by IS 'User ID of the official who initiated the deletion request';
COMMENT ON COLUMN chamas.deletion_requested_at IS 'Timestamp when the deletion request was initiated';
