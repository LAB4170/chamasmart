-- The outcome of the last nightly books check for each chama, so the portfolio view can show it without recomputing.
CREATE TABLE IF NOT EXISTS ledger_check_results (
    chama_id BIGINT PRIMARY KEY,
    all_ok BOOLEAN NOT NULL,
    failed INTEGER NOT NULL DEFAULT 0,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
