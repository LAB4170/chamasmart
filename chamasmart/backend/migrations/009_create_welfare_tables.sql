-- Create welfare_config table
CREATE TABLE IF NOT EXISTS welfare_config (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    description TEXT,
    payout_amount DECIMAL(15, 2) NOT NULL,
    contribution_type VARCHAR(20) NOT NULL CHECK (contribution_type IN ('PERIODIC', 'AD_HOC')),
    contribution_amount DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chama_id, event_type)
);

-- Create welfare_fund table
CREATE TABLE IF NOT EXISTS welfare_fund (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chama_id)
);

-- Create welfare_contributions table
CREATE TABLE IF NOT EXISTS welfare_contributions (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    contribution_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create welfare_claims table
CREATE TABLE IF NOT EXISTS welfare_claims (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type_id INTEGER NOT NULL REFERENCES welfare_config(id) ON DELETE CASCADE,
    claim_amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'VERIFIED', 'APPROVED', 'PAID', 'REJECTED')),
    date_of_occurrence DATE NOT NULL,
    proof_document_url TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create welfare_claim_approvals table
CREATE TABLE IF NOT EXISTS welfare_claim_approvals (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES welfare_claims(id) ON DELETE CASCADE,
    approver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'REJECTED')),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(claim_id, approver_id)
);

-- Create indexes for better performance
CREATE INDEX idx_welfare_claims_chama ON welfare_claims(chama_id, status);
CREATE INDEX idx_welfare_claims_member ON welfare_claims(member_id);
CREATE INDEX idx_welfare_contributions_chama_member ON welfare_contributions(chama_id, member_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_welfare_config_modtime
BEFORE UPDATE ON welfare_config
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_welfare_claims_modtime
BEFORE UPDATE ON welfare_claims
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Add initial data for common welfare event types
INSERT INTO welfare_config (chama_id, event_type, description, payout_amount, contribution_type, contribution_amount, is_active)
SELECT 
    id,
    'BEREAVEMENT_PARENT',
    'Death of a parent',
    50000.00,
    'PERIODIC',
    500.00,
    true
FROM chamas
ON CONFLICT (chama_id, event_type) DO NOTHING;

-- Add more default event types as needed...
