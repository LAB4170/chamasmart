-- ChamaSmart Database Schema (Updated to match user's PostgreSQL schema)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    national_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chamas Table
CREATE TABLE IF NOT EXISTS chamas (
    chama_id SERIAL PRIMARY KEY,
    chama_name VARCHAR(255) NOT NULL,
    chama_type VARCHAR(50) NOT NULL CHECK (chama_type IN ('ROSCA', 'ASCA', 'TABLE_BANKING', 'WELFARE')),
    description TEXT,
    contribution_amount DECIMAL(10, 2) NOT NULL,
    contribution_frequency VARCHAR(20) NOT NULL CHECK (contribution_frequency IN ('WEEKLY', 'MONTHLY', 'BI_WEEKLY')),
    meeting_day VARCHAR(20),
    meeting_time TIME,
    total_members INTEGER DEFAULT 0,
    current_fund DECIMAL(15, 2) DEFAULT 0.00,
    share_price DECIMAL(10, 2), -- Optional, primarily for ASCA share calculations
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Chama Members Junction Table
CREATE TABLE IF NOT EXISTS chama_members (
    membership_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'MEMBER' CHECK (role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER', 'MEMBER')),
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    rotation_position INTEGER,
    total_contributions DECIMAL(15, 2) DEFAULT 0.00,
    UNIQUE(chama_id, user_id)
);

-- Contributions Table
CREATE TABLE IF NOT EXISTS contributions (
    contribution_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id),
    amount DECIMAL(10, 2) NOT NULL,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) CHECK (payment_method IN ('CASH', 'MPESA', 'BANK_TRANSFER')),
    receipt_number VARCHAR(100),
    recorded_by INTEGER REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    meeting_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    meeting_date DATE NOT NULL,
    meeting_time TIME,
    location VARCHAR(255),
    agenda TEXT,
    minutes TEXT,
    total_collected DECIMAL(15, 2) DEFAULT 0.00,
    recorded_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Attendance Table
CREATE TABLE IF NOT EXISTS meeting_attendance (
    attendance_id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id),
    attended BOOLEAN DEFAULT FALSE,
    late BOOLEAN DEFAULT FALSE,
    notes TEXT,
    UNIQUE(meeting_id, user_id)
);

-- Payouts Table for ROSCA
CREATE TABLE IF NOT EXISTS payouts (
    payout_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id),
    amount DECIMAL(15, 2) NOT NULL,
    payout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meeting_id INTEGER REFERENCES meetings(meeting_id),
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loans Table for Table Banking
CREATE TABLE IF NOT EXISTS loans (
    loan_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    borrower_id INTEGER REFERENCES users(user_id),
    loan_amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    interest_type VARCHAR(20) DEFAULT 'FLAT' CHECK (interest_type IN ('FLAT','REDUCING')),
    loan_multiplier DECIMAL(10, 2),
    total_repayable DECIMAL(15, 2) NOT NULL,
    amount_paid DECIMAL(15, 2) DEFAULT 0.00,
    principal_outstanding DECIMAL(15, 2),
    interest_outstanding DECIMAL(15, 2),
    penalty_outstanding DECIMAL(15, 2) DEFAULT 0.00,
    guarantor_coverage DECIMAL(15, 2) DEFAULT 0.00,
    loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    term_months INTEGER,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING','PENDING_GUARANTOR','PENDING_APPROVAL','ACTIVE','PAID','COMPLETED','DEFAULTED','CANCELLED')),
    approved_by INTEGER REFERENCES users(user_id),
    purpose TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Guarantors Table
CREATE TABLE IF NOT EXISTS loan_guarantors (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    guarantor_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    guaranteed_amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED')) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_loan_guarantor UNIQUE (loan_id, guarantor_id)
);

-- Loan Installments Table
CREATE TABLE IF NOT EXISTS loan_installments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) NOT NULL,
    penalty_amount DECIMAL(15, 2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','PAID','OVERDUE')) DEFAULT 'PENDING',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loan Repayments Table
CREATE TABLE IF NOT EXISTS loan_repayments (
    repayment_id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(loan_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    recorded_by INTEGER REFERENCES users(user_id),
    principal_component DECIMAL(15, 2) DEFAULT 0,
    interest_component DECIMAL(15, 2) DEFAULT 0,
    penalty_component DECIMAL(15, 2) DEFAULT 0,
    source VARCHAR(20) DEFAULT 'CASH' CHECK (source IN ('MPESA','CASH','BANK')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_chamas_created_by ON chamas(created_by);
CREATE INDEX IF NOT EXISTS idx_chama_members_chama_id ON chama_members(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_members_user_id ON chama_members(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_chama_id ON contributions(chama_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_date ON contributions(contribution_date);
CREATE INDEX IF NOT EXISTS idx_meetings_chama_id ON meetings(chama_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting_id ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_payouts_chama_id ON payouts(chama_id);
CREATE INDEX IF NOT EXISTS idx_loans_chama_id ON loans(chama_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan_id ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_loan ON loan_guarantors(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_guarantors_guarantor ON loan_guarantors(guarantor_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_installments_loan ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_installments_due_status ON loan_installments(due_date, status);

-- Chama Invites Table
CREATE TABLE IF NOT EXISTS chama_invites (
    invite_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(user_id),
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invite_code ON chama_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_chama_invites ON chama_invites(chama_id);

-- ASCA / Investment tables
-- Share contributions ledger (per member, per chama)
CREATE TABLE IF NOT EXISTS asca_share_contributions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    number_of_shares DECIMAL(15, 4) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asca_share_contrib_user ON asca_share_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_asca_share_contrib_chama ON asca_share_contributions(chama_id);

-- Governance: proposals & votes (can be used for ASCA investment decisions)
CREATE TABLE IF NOT EXISTS proposals (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(user_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount_required DECIMAL(15, 2),
    deadline TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' -- 'approved', 'rejected'
);

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    vote_choice VARCHAR(10) CHECK (vote_choice IN ('YES', 'NO', 'ABSTAIN')),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_chama ON proposals(chama_id);
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);

-- Asset registry for group-owned assets
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    purchase_price DECIMAL(15, 2),
    purchase_date DATE,
    current_valuation DECIMAL(15, 2),
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_chama ON assets(chama_id);
