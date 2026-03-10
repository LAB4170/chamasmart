-- Upgrade ROSCA to 10/10 Excellence
-- Phase 1: Monetized Swaps & Autopilot Status

-- Add swap fee support
ALTER TABLE rosca_swap_requests 
ADD COLUMN IF NOT EXISTS swap_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_status CHARACTER VARYING DEFAULT 'NONE'; -- NONE, PENDING, COMPLETED

-- Add autopilot tracking to cycles
ALTER TABLE rosca_cycles
ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT FALSE;

-- Add index for performance on active swap searches
CREATE INDEX IF NOT EXISTS idx_rosca_swap_requests_status ON rosca_swap_requests(status);
