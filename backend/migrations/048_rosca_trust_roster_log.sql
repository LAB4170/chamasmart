-- Migration 048: Log how rosca roster was generated
-- Adds roster_generation_method to rosca_cycles for audit trail

ALTER TABLE rosca_cycles 
ADD COLUMN IF NOT EXISTS roster_generation_method VARCHAR(20) DEFAULT 'RANDOM';

COMMENT ON COLUMN rosca_cycles.roster_generation_method IS 'How the roster was generated: RANDOM | TRUST | MANUAL';

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_rosca_cycles_roster_method ON rosca_cycles(roster_generation_method);
