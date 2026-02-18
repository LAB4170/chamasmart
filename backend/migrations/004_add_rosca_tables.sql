-- Create ROSCA cycle table
CREATE TABLE IF NOT EXISTS rosca_cycles (
    cycle_id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    cycle_name VARCHAR(100) NOT NULL,
    contribution_amount DECIMAL(15, 2) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED')) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Add trust score to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50;

-- Create ROSCA roster table
CREATE TABLE IF NOT EXISTS rosca_roster (
    roster_id SERIAL PRIMARY KEY,
    cycle_id INTEGER NOT NULL REFERENCES rosca_cycles(cycle_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    payout_amount DECIMAL(15, 2) NOT NULL,
    payout_date DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'PAID', 'SKIPPED', 'DEFAULTED')) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_cycle_user UNIQUE (cycle_id, user_id),
    CONSTRAINT unique_cycle_position UNIQUE (cycle_id, position)
);

-- Create ROSCA contributions table (extends base contributions)
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS cycle_id INTEGER REFERENCES rosca_cycles(cycle_id) ON DELETE SET NULL;

-- Create ROSCA swap requests table
CREATE TABLE IF NOT EXISTS rosca_swap_requests (
    request_id SERIAL PRIMARY KEY,
    cycle_id INTEGER NOT NULL REFERENCES rosca_cycles(cycle_id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_position INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')) DEFAULT 'PENDING',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_swap_request CHECK (requester_id != target_position)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rosca_cycles_chama ON rosca_cycles(chama_id);
CREATE INDEX IF NOT EXISTS idx_rosca_roster_cycle ON rosca_roster(cycle_id);
CREATE INDEX IF NOT EXISTS idx_rosca_roster_user ON rosca_roster(user_id);
CREATE INDEX IF NOT EXISTS idx_rosca_swap_requests_cycle ON rosca_swap_requests(cycle_id);
CREATE INDEX IF NOT EXISTS idx_contributions_cycle ON contributions(cycle_id);
