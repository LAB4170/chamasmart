-- A reversal can only be made once, and a closed accounting period cannot receive new postings.
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_reverses ON journal_entries (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS accounting_periods (
    period_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    period_end DATE NOT NULL,
    closed_by BIGINT,
    closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    trial_debit NUMERIC(15,2) NOT NULL,
    trial_credit NUMERIC(15,2) NOT NULL,
    last_entry_id BIGINT,
    last_entry_hash VARCHAR(64),
    CONSTRAINT uq_period UNIQUE (chama_id, period_end)
);
