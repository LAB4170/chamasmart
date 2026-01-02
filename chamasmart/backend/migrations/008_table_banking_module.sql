-- 008_table_banking_module.sql
--
-- Introduces richer Table Banking support:
--  - Extends loans table with additional lifecycle/status and balances
--  - Adds loan_guarantors table
--  - Adds loan_installments table
--  - Extends loan_repayments with waterfall breakdown

-- 1. Extend loans.status to support more lifecycle states
ALTER TABLE loans
    DROP CONSTRAINT IF EXISTS loans_status_check;

ALTER TABLE loans
    ADD CONSTRAINT loans_status_check
    CHECK (status IN (
        'PENDING',              -- legacy simple flow
        'PENDING_GUARANTOR',    -- waiting on guarantor coverage
        'PENDING_APPROVAL',     -- guarantors done, waiting on treasurer
        'ACTIVE',               -- disbursed and running
        'PAID',                 -- legacy name for fully repaid
        'COMPLETED',            -- preferred name for fully repaid
        'DEFAULTED',            -- in arrears past default threshold
        'CANCELLED'             -- cancelled by member or treasurer before disbursement
    ));

-- 2. Add extended financial columns to loans
ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS interest_type VARCHAR(20) CHECK (interest_type IN ('FLAT','REDUCING')) DEFAULT 'FLAT',
    ADD COLUMN IF NOT EXISTS loan_multiplier DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS term_months INTEGER,
    ADD COLUMN IF NOT EXISTS principal_outstanding DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS interest_outstanding DECIMAL(15,2),
    ADD COLUMN IF NOT EXISTS penalty_outstanding DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guarantor_coverage DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Create loan_guarantors table
CREATE TABLE IF NOT EXISTS loan_guarantors (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    guarantor_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    guaranteed_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED')) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_loan_guarantor UNIQUE (loan_id, guarantor_id)
);

CREATE INDEX IF NOT EXISTS idx_loan_guarantors_loan ON loan_guarantors(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_guarantor ON loan_guarantors(guarantor_id, status);

-- 4. Create loan_installments table (repayment schedule)
CREATE TABLE IF NOT EXISTS loan_installments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_amount DECIMAL(15,2) NOT NULL,
    penalty_amount DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','PAID','OVERDUE')) DEFAULT 'PENDING',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_due_status ON loan_installments(due_date, status);

-- 5. Extend loan_repayments with breakdown and source
ALTER TABLE loan_repayments
    ADD COLUMN IF NOT EXISTS principal_component DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interest_component DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS penalty_component DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) CHECK (source IN ('MPESA','CASH','BANK')) DEFAULT 'CASH';

-- 6. Helpful comments
COMMENT ON TABLE loan_guarantors IS 'Per-loan guarantor records for Table Banking (ChamaSmart)';
COMMENT ON TABLE loan_installments IS 'Repayment schedule entries for loans, including principal/interest split and penalty';

DO $$
BEGIN
    RAISE NOTICE '008_table_banking_module migration applied: loans extended, loan_guarantors & loan_installments created, loan_repayments extended.';
END $$;
