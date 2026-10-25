-- A record of each time officials compared an M-Pesa statement with the chama's books.
CREATE TABLE IF NOT EXISTS reconciliation_runs (
    run_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    run_by BIGINT,
    run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    statement_lines INTEGER NOT NULL,
    statement_total NUMERIC(15,2) NOT NULL,
    matched INTEGER NOT NULL,
    missing INTEGER NOT NULL,
    held INTEGER NOT NULL,
    amount_differs INTEGER NOT NULL,
    pending INTEGER NOT NULL,
    reconciled BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recon_chama ON reconciliation_runs (chama_id, run_at DESC);
