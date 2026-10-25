-- Double-entry journal. Entries and lines are append-only, and every entry must balance.
CREATE TABLE IF NOT EXISTS journal_entries (
    entry_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    entry_type VARCHAR(40) NOT NULL,
    reference_type VARCHAR(40),
    reference_id BIGINT,
    actor_id BIGINT,
    memo VARCHAR(300),
    legacy_entry_id BIGINT,
    reverses_entry_id BIGINT,
    prev_hash VARCHAR(64) NOT NULL,
    entry_hash VARCHAR(64) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_legacy ON journal_entries (legacy_entry_id) WHERE legacy_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_chama ON journal_entries (chama_id, entry_id);

CREATE TABLE IF NOT EXISTS journal_lines (
    line_id BIGSERIAL PRIMARY KEY,
    entry_id BIGINT NOT NULL REFERENCES journal_entries (entry_id),
    chama_id BIGINT NOT NULL,
    account VARCHAR(30) NOT NULL,
    debit NUMERIC(15,2) NOT NULL DEFAULT 0,
    credit NUMERIC(15,2) NOT NULL DEFAULT 0,
    CONSTRAINT ck_journal_line_one_side CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit > 0 OR credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (chama_id, account);

-- Nothing in the journal is ever edited or removed. Mistakes are corrected with a reversing entry.
CREATE OR REPLACE FUNCTION journal_block_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'The journal is append-only (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
CREATE TRIGGER trg_journal_entries_immutable BEFORE UPDATE OR DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON journal_lines;
CREATE TRIGGER trg_journal_lines_immutable BEFORE UPDATE OR DELETE ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION journal_block_change();

-- At commit, every entry that was touched must have equal debits and credits.
CREATE OR REPLACE FUNCTION journal_check_balance() RETURNS trigger AS $$
DECLARE
    d NUMERIC(15,2);
    c NUMERIC(15,2);
BEGIN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0) INTO d, c FROM journal_lines WHERE entry_id = NEW.entry_id;
    IF d <> c THEN
        RAISE EXCEPTION 'Journal entry % does not balance: debits % credits %', NEW.entry_id, d, c;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_lines_balanced ON journal_lines;
CREATE CONSTRAINT TRIGGER trg_journal_lines_balanced AFTER INSERT ON journal_lines
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_check_balance();
