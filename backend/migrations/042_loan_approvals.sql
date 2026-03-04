-- 042_loan_approvals.sql
-- Multi-official approval system for ASCA chamas
-- Required: At least 2 officials must approve a loan before it is released

ALTER TABLE loans 
  DROP CONSTRAINT IF EXISTS loans_status_check;

ALTER TABLE loans 
  ADD CONSTRAINT loans_status_check 
  CHECK (status IN ('PENDING', 'APPROVED', 'DISBURSED', 'REJECTED', 'COMPLETED', 'DEFAULTED', 'PENDING_APPROVAL', 'PENDING_GUARANTOR'));

CREATE TABLE IF NOT EXISTS loan_approvals (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    official_user_id INTEGER NOT NULL REFERENCES users(user_id),
    status VARCHAR(10) NOT NULL CHECK (status IN ('APPROVED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(loan_id, official_user_id)
);
