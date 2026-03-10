-- Migration 049: ASCA Loan Default States for Guarantor Recovery
-- Enables tracking overdue loans and freezing guarantor shares

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS defaulted_at TIMESTAMPTZ;

-- Add freezing and deduction state to loan guarantors
ALTER TABLE loan_guarantors
ADD COLUMN IF NOT EXISTS liability_status VARCHAR(20) DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC(15, 2) DEFAULT 0;

-- Index for fast cron-based overdue queries
CREATE INDEX IF NOT EXISTS idx_loans_status_due_date 
ON loans(status, due_date) 
WHERE status NOT IN ('PAID', 'REJECTED', 'DEFAULTED');

COMMENT ON COLUMN loans.defaulted_at IS 'Timestamp when loan was marked DEFAULTED (60+ days overdue)';
COMMENT ON COLUMN loan_guarantors.liability_status IS 'NORMAL | FROZEN | DEDUCTED';
