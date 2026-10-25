-- Money leaving a chama for running costs. One official asks, others approve, someone sends it and records the reference.
CREATE TABLE IF NOT EXISTS payouts (
    payout_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'EXPENSE',
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    payee_name VARCHAR(100) NOT NULL,
    payee_phone VARCHAR(15),
    reason VARCHAR(300) NOT NULL,
    status VARCHAR(20) NOT NULL,
    required_approvals INTEGER NOT NULL DEFAULT 1,
    requested_by BIGINT NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    release_at TIMESTAMP WITH TIME ZONE,
    paid_by BIGINT,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(40),
    decision_note VARCHAR(300),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_payout_request UNIQUE (requested_by, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_payouts_chama ON payouts (chama_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_reference ON payouts (upper(payment_reference)) WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS payout_approvals (
    approval_id BIGSERIAL PRIMARY KEY,
    payout_id BIGINT NOT NULL REFERENCES payouts (payout_id),
    approver_id BIGINT NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_payout_approver UNIQUE (payout_id, approver_id)
);
