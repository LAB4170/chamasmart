-- Migration: 031_hybrid_payment_upgrade.sql
-- Purpose: Add support for multi-mode payments (M-Pesa, Cash, Manual Evidence)

-- Explicitly add columns if they don't exist (Handling potential drift)
DO $$ 
BEGIN
    -- Add payment_method
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='payment_method') THEN
        ALTER TABLE contributions ADD COLUMN payment_method VARCHAR(20) DEFAULT 'CASH';
    END IF;

    -- Add receipt_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='receipt_number') THEN
        ALTER TABLE contributions ADD COLUMN receipt_number VARCHAR(100);
    END IF;

    -- Add payment_proof (URL/Evidence)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='payment_proof') THEN
        ALTER TABLE contributions ADD COLUMN payment_proof TEXT;
    END IF;

    -- Add verification_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='verification_status') THEN
        ALTER TABLE contributions ADD COLUMN verification_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;

    -- Add recorded_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='recorded_by') THEN
        ALTER TABLE contributions ADD COLUMN recorded_by INTEGER REFERENCES users(user_id);
    END IF;

    -- Add notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='notes') THEN
        ALTER TABLE contributions ADD COLUMN notes TEXT;
    END IF;
    
    -- Add idempotency_key for safe retries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='idempotency_key') THEN
        ALTER TABLE contributions ADD COLUMN idempotency_key UUID;
    END IF;
END $$;

-- Update constraints
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS check_verification_status;
ALTER TABLE contributions ADD CONSTRAINT check_verification_status CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'));

ALTER TABLE contributions DROP CONSTRAINT IF EXISTS check_payment_method;
ALTER TABLE contributions ADD CONSTRAINT check_payment_method CHECK (payment_method IN ('CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'));

-- Add indexes for reconciliation
CREATE INDEX IF NOT EXISTS idx_contributions_receipt ON contributions(receipt_number);
CREATE INDEX IF NOT EXISTS idx_contributions_verification ON contributions(verification_status);
CREATE INDEX IF NOT EXISTS idx_contributions_idempotency ON contributions(idempotency_key);
