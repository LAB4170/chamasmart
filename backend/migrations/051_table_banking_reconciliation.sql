-- Migration 051 (fixed): Table Banking Hard-Lock Reconciliation
-- The Table Banking sessions live in the existing `meetings` table

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS physical_cash_count NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS discrepancy_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_note TEXT,
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(20) DEFAULT 'PENDING';

COMMENT ON COLUMN meetings.reconciliation_status IS 'PENDING | MATCHED | DISCREPANCY';
COMMENT ON COLUMN meetings.discrepancy_note IS 'Required when closing session with a cash discrepancy';
COMMENT ON COLUMN meetings.physical_cash_count IS 'Physical cash counted by Treasurer at session close';
COMMENT ON COLUMN meetings.expected_cash IS 'System-computed expected cash: opening + collected - disbursed';
