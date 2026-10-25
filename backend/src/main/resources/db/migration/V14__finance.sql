-- Finance console: platform invoices (ChamaSmart's own revenue), and two-person money requests
-- (assigning unclaimed payments, returning them, refunding invoices).

CREATE SEQUENCE IF NOT EXISTS platform_invoice_seq START 1;

CREATE TABLE IF NOT EXISTS platform_invoices (
    invoice_id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    chama_id BIGINT NOT NULL,
    plan_code VARCHAR(30) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    gross NUMERIC(15,2) NOT NULL CHECK (gross > 0),
    net NUMERIC(15,2) NOT NULL,
    vat NUMERIC(15,2) NOT NULL CHECK (vat >= 0),
    vat_rate NUMERIC(5,4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    reference VARCHAR(120) NOT NULL UNIQUE,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_issued ON platform_invoices (issued_at);
DROP TRIGGER IF EXISTS trg_invoices_immutable ON platform_invoices;
CREATE TRIGGER trg_invoices_immutable BEFORE UPDATE OR DELETE ON platform_invoices FOR EACH ROW EXECUTE FUNCTION journal_block_change();

CREATE TABLE IF NOT EXISTS finance_requests (
    request_id BIGSERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('ASSIGN_PAYMENT','RETURN_PAYMENT','REFUND')),
    status VARCHAR(12) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','APPROVED','DONE','REJECTED','CANCELLED')),
    event_id BIGINT,
    invoice_id BIGINT,
    chama_id BIGINT,
    user_id BIGINT,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    reason VARCHAR(500) NOT NULL,
    external_ref VARCHAR(120),
    proposed_by BIGINT NOT NULL,
    proposed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    decided_by BIGINT,
    decided_at TIMESTAMP WITH TIME ZONE,
    decision_note VARCHAR(500),
    done_by BIGINT,
    done_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finreq_open_event ON finance_requests (event_id) WHERE event_id IS NOT NULL AND status IN ('PROPOSED','APPROVED');
CREATE OR REPLACE FUNCTION finance_request_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Finance requests are kept for good and cannot be deleted'; END IF;
    IF OLD.status IN ('DONE','REJECTED','CANCELLED') THEN RAISE EXCEPTION 'A finished finance request cannot be changed'; END IF;
    IF NEW.amount <> OLD.amount OR NEW.kind <> OLD.kind OR NEW.proposed_by <> OLD.proposed_by THEN RAISE EXCEPTION 'The amount, kind and proposer of a finance request cannot be changed'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_finreq_guard ON finance_requests;
CREATE TRIGGER trg_finreq_guard BEFORE UPDATE OR DELETE ON finance_requests FOR EACH ROW EXECUTE FUNCTION finance_request_guard();

INSERT INTO role_permissions (role_code, permission) VALUES
 ('SUPER_ADMIN','FINANCE_MANAGE'),('SUPER_ADMIN','FINANCE_APPROVE'),
 ('ACCOUNTING','FINANCE_MANAGE')
ON CONFLICT DO NOTHING;
