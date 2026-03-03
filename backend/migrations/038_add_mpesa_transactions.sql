-- Migration: 038_add_mpesa_transactions.sql
-- Purpose: Track M-Pesa STK Push requests and map to contributions

CREATE TABLE IF NOT EXISTS mpesa_transactions (
    transaction_id SERIAL PRIMARY KEY,
    checkout_request_id VARCHAR(100) UNIQUE NOT NULL,
    merchant_request_id VARCHAR(100),
    user_id INTEGER REFERENCES users(user_id),
    chama_id INTEGER REFERENCES chamas(chama_id),
    amount NUMERIC(15, 2) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED, CANCELLED
    result_code INTEGER,
    result_desc TEXT,
    mpesa_receipt VARCHAR(50),
    contribution_id INTEGER REFERENCES contributions(contribution_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mpesa_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_user_chama ON mpesa_transactions(user_id, chama_id);
