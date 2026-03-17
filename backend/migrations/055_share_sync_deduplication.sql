-- ============================================================================
-- MIGRATION: 055_share_sync_deduplication.sql
-- Purpose: Add contribution_id tracking to asca_share_contributions to prevent
--          duplicate share entries, and ensure TABLE_BANKING chamas have a
--          default share_price so contributions can be automatically actualized.
-- Created: 2026-03-18
-- ============================================================================

-- 1. Create asca_share_contributions if it doesn't exist yet
CREATE TABLE IF NOT EXISTS asca_share_contributions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    cycle_id INTEGER REFERENCES asca_cycles(cycle_id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    number_of_shares DECIMAL(15,6) NOT NULL DEFAULT 0,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add contribution_id column for deduplication (allows tracking which contribution
--    was synced so we never double-count)
ALTER TABLE asca_share_contributions
    ADD COLUMN IF NOT EXISTS contribution_id INTEGER REFERENCES contributions(contribution_id) ON DELETE SET NULL;

-- 3. Add a unique constraint so the same contribution cannot be synced twice
ALTER TABLE asca_share_contributions
    DROP CONSTRAINT IF EXISTS uq_asca_share_contribution_id;

ALTER TABLE asca_share_contributions
    ADD CONSTRAINT uq_asca_share_contribution_id UNIQUE (contribution_id);

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_asca_share_contributions_chama_id ON asca_share_contributions(chama_id);
CREATE INDEX IF NOT EXISTS idx_asca_share_contributions_user_id ON asca_share_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_asca_share_contributions_cycle_id ON asca_share_contributions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_asca_share_contributions_contrib_id ON asca_share_contributions(contribution_id);

-- 5. Ensure TABLE_BANKING chamas have a share_price set (default KES 1 if unset)
--    This means each KES contributed = 1 actualized share by default
UPDATE chamas
    SET share_price = 1
    WHERE chama_type = 'TABLE_BANKING'
      AND (share_price IS NULL OR share_price = 0);

RAISE NOTICE 'Migration 055 completed: share sync deduplication and TABLE_BANKING share_price defaults applied.';
