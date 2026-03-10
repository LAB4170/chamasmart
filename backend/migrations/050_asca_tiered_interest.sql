-- Migration 050: ASCA Tiered Interest Rates (Loyalty Pricing)
-- Tracks what discount/premium was applied when loan was created

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS trust_discount_applied NUMERIC(5, 4) DEFAULT 0;

COMMENT ON COLUMN loans.trust_discount_applied IS 'Decimal representing the discount factor applied. e.g., -0.02 for 2% discount, +0.01 for 1% premium';
