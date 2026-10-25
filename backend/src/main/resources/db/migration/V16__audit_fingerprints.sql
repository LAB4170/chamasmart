-- A fingerprint is the position and hash of the activity log at a moment. Each one is also emailed to the super admins, so a copy
-- exists outside the database; if history is ever rewritten, the rewrite will not match the emailed copies.
CREATE TABLE IF NOT EXISTS audit_fingerprints (
    fingerprint_id BIGSERIAL PRIMARY KEY,
    label VARCHAR(20) NOT NULL,
    head_seq BIGINT NOT NULL,
    head_hash VARCHAR(64) NOT NULL,
    entries BIGINT NOT NULL,
    chain_ok BOOLEAN NOT NULL,
    emailed_to INTEGER NOT NULL DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_fingerprints_immutable ON audit_fingerprints;
CREATE TRIGGER trg_fingerprints_immutable BEFORE UPDATE OR DELETE ON audit_fingerprints FOR EACH ROW EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_fingerprints_truncate ON audit_fingerprints;
CREATE TRIGGER trg_fingerprints_truncate BEFORE TRUNCATE ON audit_fingerprints FOR EACH STATEMENT EXECUTE FUNCTION journal_block_change();
