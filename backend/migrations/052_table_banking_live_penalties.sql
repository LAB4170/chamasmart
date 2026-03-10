-- Migration 052 (fixed): Table Banking Live Penalties & Digital Minutes
-- session_penalties references meetings.meeting_id

CREATE TABLE IF NOT EXISTS session_penalties (
    penalty_id     SERIAL PRIMARY KEY,
    meeting_id     INTEGER NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(user_id),
    penalty_type   VARCHAR(50) NOT NULL,  -- 'LATE_ENTRY' | 'DISRUPTIVE' | 'ABSENTEE' | 'CUSTOM'
    amount         NUMERIC(15, 2) NOT NULL DEFAULT 0,
    note           TEXT,
    added_by       INTEGER NOT NULL REFERENCES users(user_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_penalties_meeting ON session_penalties(meeting_id);
CREATE INDEX IF NOT EXISTS idx_session_penalties_user ON session_penalties(user_id);

-- Digital Minutes / signed PDF on the meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS minutes_pdf_url     TEXT,
ADD COLUMN IF NOT EXISTS minutes_signed_by   JSONB DEFAULT '[]';

COMMENT ON COLUMN meetings.minutes_signed_by IS 'Array of {role, user_id, signed_at} — digital signatures from Chairperson and Secretary';
COMMENT ON TABLE session_penalties IS 'Live fines added during a Table Banking session meeting by Secretary';
