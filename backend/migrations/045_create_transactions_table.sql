-- Migration: Create transactions table
-- Description: Centralized financial ledger for all chama movements
-- Date: 2026-03-07

CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id INTEGER, -- e.g., claim_id, loan_id
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategic indexes for performance
CREATE INDEX idx_transactions_chama_id ON transactions(chama_id);
CREATE INDEX idx_transactions_member_id ON transactions(member_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Add comment for documentation
COMMENT ON COLUMN transactions.transaction_type IS 'e.g., WELFARE_CONTRIBUTION, WELFARE_PAYOUT, LOAN_DISBURSEMENT, LOAN_REPAYMENT';
