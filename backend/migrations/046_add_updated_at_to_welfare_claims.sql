-- Migration: Add updated_at to welfare_claims
-- Description: Fixes 500 error in approval flow by adding missing audit column
-- Date: 2026-03-07

ALTER TABLE welfare_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Also ensure welfare_claim_approvals has it for consistency
ALTER TABLE welfare_claim_approvals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add triggers for automatic updates if they don't exist
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_welfare_claims_updated_at ON welfare_claims;
CREATE TRIGGER trigger_welfare_claims_updated_at
    BEFORE UPDATE ON welfare_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trigger_welfare_claim_approvals_updated_at ON welfare_claim_approvals;
CREATE TRIGGER trigger_welfare_claim_approvals_updated_at
    BEFORE UPDATE ON welfare_claim_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();
