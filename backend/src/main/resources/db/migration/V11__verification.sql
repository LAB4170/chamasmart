-- Public listing review, signed agreements, enforcement cases and the platform operator's own audit trail.
CREATE TABLE IF NOT EXISTS chama_verifications (
    chama_id BIGINT PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    registration_body VARCHAR(120),
    registration_number VARCHAR(60),
    registered_name VARCHAR(160),
    collection_summary VARCHAR(300),
    public_blurb VARCHAR(500),
    contact_phone VARCHAR(20),
    submitted_by BIGINT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note VARCHAR(500),
    listed_at TIMESTAMP WITH TIME ZONE,
    next_review_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification_checks (
    chama_id BIGINT NOT NULL,
    item_code VARCHAR(40) NOT NULL,
    passed BOOLEAN NOT NULL,
    note VARCHAR(300),
    checked_by BIGINT NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (chama_id, item_code)
);

CREATE TABLE IF NOT EXISTS agreement_versions (
    agreement_id BIGSERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    body_hash VARCHAR(64) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
    reviewed_by_counsel VARCHAR(160),
    published_by BIGINT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_agreement_version UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS agreement_acceptances (
    acceptance_id BIGSERIAL PRIMARY KEY,
    agreement_id BIGINT NOT NULL REFERENCES agreement_versions (agreement_id),
    user_id BIGINT NOT NULL,
    chama_id BIGINT NOT NULL,
    body_hash VARCHAR(64) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ip_address VARCHAR(64),
    user_agent VARCHAR(300),
    CONSTRAINT uq_acceptance UNIQUE (agreement_id, user_id, chama_id)
);

CREATE TABLE IF NOT EXISTS enforcement_cases (
    case_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
    status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    urgent BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(1000) NOT NULL,
    opened_by BIGINT NOT NULL,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    response_text VARCHAR(2000),
    responded_by BIGINT,
    responded_at TIMESTAMP WITH TIME ZONE,
    resolved_by BIGINT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_note VARCHAR(1000)
);
CREATE INDEX IF NOT EXISTS idx_cases_chama ON enforcement_cases (chama_id, status);

CREATE TABLE IF NOT EXISTS admin_actions (
    action_id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    action VARCHAR(40) NOT NULL,
    chama_id BIGINT,
    detail VARCHAR(600),
    ip_address VARCHAR(64),
    at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_at ON admin_actions (at DESC);

-- Acceptances and the operator's trail are evidence: they can be added to but never changed or removed.
DROP TRIGGER IF EXISTS trg_acceptances_immutable ON agreement_acceptances;
CREATE TRIGGER trg_acceptances_immutable BEFORE UPDATE OR DELETE ON agreement_acceptances FOR EACH ROW EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_admin_actions_immutable ON admin_actions;
CREATE TRIGGER trg_admin_actions_immutable BEFORE UPDATE OR DELETE ON admin_actions FOR EACH ROW EXECUTE FUNCTION journal_block_change();
