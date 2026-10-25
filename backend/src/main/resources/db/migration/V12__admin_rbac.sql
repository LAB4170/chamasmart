-- Staff roles and permissions, platform settings, and a tamper-evident admin trail.
CREATE TABLE IF NOT EXISTS staff_roles (
    role_code VARCHAR(40) PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    description VARCHAR(300),
    system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_code VARCHAR(40) NOT NULL REFERENCES staff_roles (role_code),
    permission VARCHAR(40) NOT NULL,
    PRIMARY KEY (role_code, permission)
);

CREATE TABLE IF NOT EXISTS staff_accounts (
    user_id BIGINT PRIMARY KEY,
    status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    changed_by BIGINT,
    changed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS staff_assignments (
    user_id BIGINT NOT NULL REFERENCES staff_accounts (user_id),
    role_code VARCHAR(40) NOT NULL REFERENCES staff_roles (role_code),
    PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key VARCHAR(60) PRIMARY KEY,
    setting_value VARCHAR(200) NOT NULL,
    updated_by BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (setting_key, setting_value) VALUES ('two_person_rule', 'false') ON CONFLICT DO NOTHING;

INSERT INTO staff_roles (role_code, label, description, system_role) VALUES
 ('SUPER_ADMIN', 'Super admin', 'Everything, including staff, settings and final approvals', TRUE),
 ('VERIFICATION_REVIEWER', 'Verification reviewer', 'Works through the listing checkpoints', TRUE),
 ('LEGAL', 'Legal', 'Agreements, enforcement cases and referrals', TRUE),
 ('ACCOUNTING', 'Accounting', 'Unclaimed payments, billing and reconciliation oversight', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission)
SELECT 'SUPER_ADMIN', p FROM unnest(ARRAY['OVERVIEW_VIEW','STAFF_MANAGE','SETTINGS_MANAGE','AUDIT_VIEW','VERIFY_VIEW','VERIFY_REVIEW','LISTING_APPROVE','AGREEMENT_MANAGE','CASE_VIEW','CASE_OPEN','CASE_ESCALATE','CASE_RESOLVE','FINANCE_VIEW']) p
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_code, permission)
SELECT 'VERIFICATION_REVIEWER', p FROM unnest(ARRAY['OVERVIEW_VIEW','VERIFY_VIEW','VERIFY_REVIEW','CASE_VIEW']) p ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_code, permission)
SELECT 'LEGAL', p FROM unnest(ARRAY['OVERVIEW_VIEW','VERIFY_VIEW','AGREEMENT_MANAGE','CASE_VIEW','CASE_OPEN','CASE_ESCALATE','CASE_RESOLVE']) p ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_code, permission)
SELECT 'ACCOUNTING', p FROM unnest(ARRAY['OVERVIEW_VIEW','FINANCE_VIEW']) p ON CONFLICT DO NOTHING;

-- Anyone already an administrator keeps full access.
INSERT INTO staff_accounts (user_id) SELECT user_id FROM users WHERE upper(role) = 'ADMIN' ON CONFLICT DO NOTHING;
INSERT INTO staff_assignments (user_id, role_code) SELECT user_id, 'SUPER_ADMIN' FROM staff_accounts ON CONFLICT DO NOTHING;

-- Admin trail: hash chain, outcome and the roles held at the time.
ALTER TABLE admin_actions ADD COLUMN IF NOT EXISTS seq BIGINT;
ALTER TABLE admin_actions ADD COLUMN IF NOT EXISTS at_micros BIGINT;
ALTER TABLE admin_actions ADD COLUMN IF NOT EXISTS outcome VARCHAR(10) NOT NULL DEFAULT 'ALLOWED';
ALTER TABLE admin_actions ADD COLUMN IF NOT EXISTS roles VARCHAR(200);
ALTER TABLE admin_actions ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
ALTER TABLE admin_actions ADD COLUMN IF NOT EXISTS row_hash VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_actions_seq ON admin_actions (seq) WHERE seq IS NOT NULL;

DROP TRIGGER IF EXISTS trg_admin_actions_truncate ON admin_actions;
CREATE TRIGGER trg_admin_actions_truncate BEFORE TRUNCATE ON admin_actions FOR EACH STATEMENT EXECUTE FUNCTION journal_block_change();
DROP TRIGGER IF EXISTS trg_acceptances_truncate ON agreement_acceptances;
CREATE TRIGGER trg_acceptances_truncate BEFORE TRUNCATE ON agreement_acceptances FOR EACH STATEMENT EXECUTE FUNCTION journal_block_change();

-- Enforcement: a level 3 or 4 notice can wait for a second person's confirmation.
ALTER TABLE enforcement_cases ADD COLUMN IF NOT EXISTS confirmed_by BIGINT;
ALTER TABLE enforcement_cases ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
