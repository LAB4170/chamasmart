-- Migration 053 (fixed): Welfare Tranche Payouts & Transparency Ledger  
-- welfare_claims uses 'id' as PK, 'claim_amount', 'event_type_id', 'member_id'

ALTER TABLE welfare_claims
ADD COLUMN IF NOT EXISTS disbursement_stage      INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_stages            INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS next_disbursement_date  DATE,
ADD COLUMN IF NOT EXISTS amount_disbursed_so_far NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_approved         NUMERIC(15, 2);

-- Update amount_approved from existing claim_amount for any currently approved claims
UPDATE welfare_claims
SET amount_approved = claim_amount
WHERE status IN ('APPROVED', 'PAID') AND amount_approved IS NULL;

-- Transparency Ledger View (privacy-safe — initials only)
CREATE OR REPLACE VIEW welfare_payout_ledger AS
SELECT
    wc.claim_id                                               AS claim_id,
    wc.chama_id,
    wf.event_type                                             AS claim_category,
    wc.claim_amount                                           AS amount_approved,
    COALESCE(wc.amount_disbursed_so_far, 0)                   AS amount_disbursed_so_far,
    wc.disbursement_stage,
    wc.total_stages,
    wc.updated_at                                             AS last_disbursed_at,
    UPPER(LEFT(u.first_name, 1)) || '.' || UPPER(LEFT(u.last_name, 1)) || '.'  AS recipient_initials
FROM welfare_claims wc
JOIN users u             ON u.user_id       = wc.member_id
JOIN welfare_config wf   ON wf.config_id    = wc.event_type_id
WHERE wc.status IN ('APPROVED', 'PAID');

COMMENT ON VIEW welfare_payout_ledger IS 'Read-only ledger visible to all Chama members. Shows only initials for privacy.';
