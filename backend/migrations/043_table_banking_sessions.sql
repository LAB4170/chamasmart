-- 043_table_banking_sessions.sql
-- Adds session-aware columns to meetings and creates a session log for financial reconciliation

-- 1. Extend meetings table with session status and financial tracking
ALTER TABLE meetings
    ADD COLUMN IF NOT EXISTS session_status VARCHAR(20) CHECK (session_status IN ('NOT_STARTED', 'OPEN', 'LOCKED', 'CLOSED')) DEFAULT 'NOT_STARTED',
    ADD COLUMN IF NOT EXISTS opening_cash DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS closing_cash DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_collections DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_disbursements DECIMAL(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS session_opened_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS session_closed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS closed_by INTEGER REFERENCES users(user_id);

-- 2. Create meeting_penalties table for automated fines
CREATE TABLE IF NOT EXISTS meeting_penalties (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('PENDING', 'PAID', 'WAIVED')) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_meeting_penalty UNIQUE (meeting_id, user_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_meeting_penalties_user ON meeting_penalties(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_penalties_meeting ON meeting_penalties(meeting_id);

-- 3. Add meeting_id to contributions and loan_repayments for session attribution
ALTER TABLE contributions 
    ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(meeting_id);

ALTER TABLE loan_repayments
    ADD COLUMN IF NOT EXISTS meeting_id INTEGER REFERENCES meetings(meeting_id);

-- 4. Comments for documentation
COMMENT ON COLUMN meetings.session_status IS 'Lifecycle of the meeting financial session (Table Banking)';
COMMENT ON TABLE meeting_penalties IS 'Automatic or manual fines issued during a meeting session';

DO $$
BEGIN
    RAISE NOTICE '043_table_banking_sessions migration applied: meeting sessions and penalties infrastructure ready.';
END $$;
