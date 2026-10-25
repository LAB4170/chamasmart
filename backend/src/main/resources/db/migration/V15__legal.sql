-- Legal console: case notes and evidence, the register of court orders and requests, and a record of every disclosure.

CREATE TABLE IF NOT EXISTS case_notes (
    note_id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL REFERENCES enforcement_cases (case_id),
    author_id BIGINT NOT NULL,
    body VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_notes_case ON case_notes (case_id);

CREATE TABLE IF NOT EXISTS case_evidence (
    evidence_id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL REFERENCES enforcement_cases (case_id),
    doc_id BIGINT NOT NULL REFERENCES chama_documents (doc_id),
    note VARCHAR(500),
    added_by BIGINT NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_case_evidence UNIQUE (case_id, doc_id)
);

CREATE TABLE IF NOT EXISTS legal_orders (
    order_id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(120) NOT NULL,
    kind VARCHAR(24) NOT NULL CHECK (kind IN ('COURT_ORDER','PRESERVATION','DISCLOSURE_REQUEST','POLICE_REQUEST','REGULATOR_REQUEST','OTHER')),
    issuing_body VARCHAR(160) NOT NULL,
    received_on DATE NOT NULL,
    due_on DATE,
    chama_id BIGINT,
    case_id BIGINT REFERENCES enforcement_cases (case_id),
    summary VARCHAR(1000) NOT NULL,
    status VARCHAR(14) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','UNDER_REVIEW','COMPLIED','CONTESTED','CLOSED')),
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_legal_orders_status ON legal_orders (status, due_on);

CREATE TABLE IF NOT EXISTS legal_order_events (
    event_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES legal_orders (order_id),
    actor_id BIGINT NOT NULL,
    status_to VARCHAR(14) NOT NULL,
    note VARCHAR(1000) NOT NULL,
    at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_disclosures (
    disclosure_id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    chama_id BIGINT NOT NULL,
    order_id BIGINT REFERENCES legal_orders (order_id),
    recipient VARCHAR(200) NOT NULL,
    basis VARCHAR(1000) NOT NULL,
    included_documents BOOLEAN NOT NULL,
    manifest_sha256 VARCHAR(64) NOT NULL,
    generated_by BIGINT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Evidence and disclosures are kept exactly as written. Orders keep their rows but cannot be deleted; their history is append-only.
DROP TRIGGER IF EXISTS trg_case_notes_immutable ON case_notes;
CREATE TRIGGER trg_case_notes_immutable BEFORE UPDATE OR DELETE ON case_notes FOR EACH ROW EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_case_evidence_immutable ON case_evidence;
CREATE TRIGGER trg_case_evidence_immutable BEFORE UPDATE OR DELETE ON case_evidence FOR EACH ROW EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_order_events_immutable ON legal_order_events;
CREATE TRIGGER trg_order_events_immutable BEFORE UPDATE OR DELETE ON legal_order_events FOR EACH ROW EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_disclosures_immutable ON legal_disclosures;
CREATE TRIGGER trg_disclosures_immutable BEFORE UPDATE OR DELETE ON legal_disclosures FOR EACH ROW EXECUTE FUNCTION journal_block_change();
CREATE OR REPLACE FUNCTION legal_order_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'The order register is kept for good and rows cannot be deleted'; END IF;
    IF NEW.reference <> OLD.reference OR NEW.kind <> OLD.kind OR NEW.issuing_body <> OLD.issuing_body OR NEW.received_on <> OLD.received_on OR NEW.summary <> OLD.summary THEN
        RAISE EXCEPTION 'What an order says cannot be changed; record a new status instead';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_legal_orders_guard ON legal_orders;
CREATE TRIGGER trg_legal_orders_guard BEFORE UPDATE OR DELETE ON legal_orders FOR EACH ROW EXECUTE FUNCTION legal_order_guard();

INSERT INTO role_permissions (role_code, permission) VALUES
 ('SUPER_ADMIN','LEGAL_ORDERS'),('SUPER_ADMIN','CASE_REFERRAL'),
 ('LEGAL','LEGAL_ORDERS'),('LEGAL','CASE_REFERRAL')
ON CONFLICT DO NOTHING;
