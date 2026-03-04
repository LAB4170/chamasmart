ALTER TABLE asca_cycles DROP CONSTRAINT IF EXISTS asca_cycles_status_check;
ALTER TABLE asca_cycles ALTER COLUMN status TYPE VARCHAR(30);
ALTER TABLE asca_cycles ADD CONSTRAINT asca_cycles_status_check CHECK (status IN ('ACTIVE', 'CLOSED_PENDING_PAYOUT', 'COMPLETED', 'CANCELLED'));
