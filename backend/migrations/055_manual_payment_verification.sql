-- Migration: 055_manual_payment_verification.sql
-- Purpose: Add manual payment verification tracking and payment setup flag to chamas

DO $$
BEGIN
    -- Track who verified a contribution and when
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='verified_by') THEN
        ALTER TABLE contributions ADD COLUMN verified_by INT REFERENCES users(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='verified_at') THEN
        ALTER TABLE contributions ADD COLUMN verified_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='rejection_reason') THEN
        ALTER TABLE contributions ADD COLUMN rejection_reason TEXT;
    END IF;

    -- Flag on chamas to indicate manual payment is accepted
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chamas' AND column_name='accepts_manual_payment') THEN
        ALTER TABLE chamas ADD COLUMN accepts_manual_payment BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Index for fast pending lookups by admin
CREATE INDEX IF NOT EXISTS idx_contributions_pending 
  ON contributions(chama_id, verification_status) 
  WHERE verification_status = 'PENDING';
