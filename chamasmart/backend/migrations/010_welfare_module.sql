-- 010_welfare_module.sql
-- Migration for Welfare Module
-- This migration creates all necessary tables for the Welfare Module

-- Create welfare_config table
CREATE TABLE IF NOT EXISTS welfare_config (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
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
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chama_id)
);

-- Create welfare_contributions table
CREATE TABLE IF NOT EXISTS welfare_contributions (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    contribution_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create welfare_claims table
CREATE TABLE IF NOT EXISTS welfare_claims (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
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
    approver_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'REJECTED')),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(claim_id, approver_id)
);

-- Create indexes (non-concurrent to avoid transaction issues)
CREATE INDEX IF NOT EXISTS idx_welfare_claims_chama ON welfare_claims(chama_id, status);
CREATE INDEX IF NOT EXISTS idx_welfare_claims_member ON welfare_claims(member_id);
CREATE INDEX IF NOT EXISTS idx_welfare_contributions_chama_member ON welfare_contributions(chama_id, member_id);

-- Add trigger function for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;;

-- Add triggers for updated_at
CREATE TRIGGER update_welfare_config_modtime
BEFORE UPDATE ON welfare_config
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_welfare_claims_modtime
BEFORE UPDATE ON welfare_claims
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Add default welfare event types for each chama
DO $$
DECLARE
    chama_record RECORD;
BEGIN
    FOR chama_record IN SELECT chama_id FROM chamas LOOP
        -- Bereavement - Parent
        INSERT INTO welfare_config (
            chama_id, 
            event_type, 
            description, 
            payout_amount, 
            contribution_type, 
            contribution_amount, 
            is_active
        ) VALUES (
            chama_record.chama_id,
            'BEREAVEMENT_PARENT',
            'Death of a parent',
            50000.00,
            'PERIODIC',
            500.00,
            true
        )
        ON CONFLICT (chama_id, event_type) DO NOTHING;

        -- Bereavement - Spouse
        INSERT INTO welfare_config (
            chama_id, 
            event_type, 
            description, 
            payout_amount, 
            contribution_type, 
            contribution_amount, 
            is_active
        ) VALUES (
            chama_record.chama_id,
            'BEREAVEMENT_SPOUSE',
            'Death of a spouse',
            100000.00,
            'PERIODIC',
            500.00,
            true
        )
        ON CONFLICT (chama_id, event_type) DO NOTHING;

        -- Hospitalization
        INSERT INTO welfare_config (
            chama_id, 
            event_type, 
            description, 
            payout_amount, 
            contribution_type, 
            contribution_amount, 
            is_active
        ) VALUES (
            chama_record.chama_id,
            'HOSPITALIZATION',
            'Hospitalization for more than 3 days',
            30000.00,
            'AD_HOC',
            200.00,
            true
        )
        ON CONFLICT (chama_id, event_type) DO NOTHING;
    END LOOP;
END $$;

-- Initialize welfare fund for existing chamas
INSERT INTO welfare_fund (chama_id, balance)
SELECT chama_id, 0 FROM chamas
ON CONFLICT (chama_id) DO NOTHING;

-- Add comment to document the migration
COMMENT ON TABLE welfare_config IS 'Stores configuration for different types of welfare events and their payouts';
COMMENT ON TABLE welfare_fund IS 'Tracks the current balance of welfare funds for each chama';
COMMENT ON TABLE welfare_contributions IS 'Records all contributions made to the welfare fund';
COMMENT ON TABLE welfare_claims IS 'Tracks welfare claims submitted by members';
COMMENT ON TABLE welfare_claim_approvals IS 'Tracks approvals/rejections of welfare claims by administrators';

-- Log successful completion
DO $$
BEGIN
    RAISE NOTICE 'Welfare module tables and default data created successfully';
END $$;
