-- Migration: 013_audit_logging_system.sql
-- Purpose: Create comprehensive audit logging tables for KDPA 2019 compliance
-- Created: 2026-01-18

-- ============================================================================
-- AUDIT LOGS TABLE (General Data Access)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- READ, CREATE, UPDATE, DELETE, EXPORT, etc
    resource_type VARCHAR(100) NOT NULL, -- users, chamas, contributions, loans, etc
    resource_id INTEGER, -- ID of the resource accessed
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);

-- ============================================================================
-- FINANCIAL AUDIT LOGS TABLE (All Financial Transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_audit_logs (
    financial_audit_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    transaction_type VARCHAR(100) NOT NULL, -- CONTRIBUTION, LOAN_DISBURSEMENT, PAYOUT, etc
    amount DECIMAL(12, 2),
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE SET NULL,
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_financial_audit_user ON financial_audit_logs(user_id);
CREATE INDEX idx_financial_audit_chama ON financial_audit_logs(chama_id);
CREATE INDEX idx_financial_audit_type ON financial_audit_logs(transaction_type);
CREATE INDEX idx_financial_audit_created_at ON financial_audit_logs(created_at DESC);

-- ============================================================================
-- AUTHENTICATION AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_audit_logs (
    auth_audit_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- LOGIN, LOGOUT, FAILED_LOGIN, PASSWORD_CHANGE, 2FA_ENABLED, MFA_DISABLED
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50), -- SUCCESS, FAILED, etc
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_audit_user ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_event ON auth_audit_logs(event_type);
CREATE INDEX idx_auth_audit_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX idx_auth_audit_ip ON auth_audit_logs(ip_address);

-- ============================================================================
-- CONSENT AUDIT LOGS TABLE (GDPR/KDPA Consent Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consent_audit_logs (
    consent_audit_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    consent_type VARCHAR(100) NOT NULL, -- MARKETING, DATA_PROCESSING, THIRD_PARTY, COOKIES, etc
    granted BOOLEAN NOT NULL,
    ip_address INET,
    consent_version VARCHAR(20),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consent_audit_user ON consent_audit_logs(user_id);
CREATE INDEX idx_consent_audit_type ON consent_audit_logs(consent_type);
CREATE INDEX idx_consent_audit_granted ON consent_audit_logs(granted);
CREATE INDEX idx_consent_audit_created_at ON consent_audit_logs(created_at DESC);

-- ============================================================================
-- DATA EXPORT LOGS TABLE (DSAR - Data Subject Access Requests)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_export_logs (
    export_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    export_type VARCHAR(100) NOT NULL, -- PERSONAL_DATA_EXPORT, DSAR_RESPONSE, DATA_PORTABILITY
    exported_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    file_path TEXT,
    file_hash VARCHAR(256),
    exported_records INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_export_user ON data_export_logs(user_id);
CREATE INDEX idx_data_export_exported_by ON data_export_logs(exported_by_user_id);
CREATE INDEX idx_data_export_created_at ON data_export_logs(created_at DESC);

-- ============================================================================
-- DELETION AUDIT LOGS TABLE (GDPR Right to be Forgotten)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deletion_audit_logs (
    deletion_id SERIAL PRIMARY KEY,
    user_id INTEGER, -- Can be NULL if user was already deleted
    deletion_type VARCHAR(100) NOT NULL, -- HARD_DELETE, GDPR_ERASURE, RETENTION_CLEANUP, USER_REQUESTED
    requested_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deletion_audit_user ON deletion_audit_logs(user_id);
CREATE INDEX idx_deletion_audit_type ON deletion_audit_logs(deletion_type);
CREATE INDEX idx_deletion_audit_created_at ON deletion_audit_logs(created_at DESC);

-- ============================================================================
-- DATA RETENTION POLICY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_retention_policy (
    policy_id SERIAL PRIMARY KEY,
    data_category VARCHAR(100) NOT NULL, -- users, contributions, loans, meetings, etc
    retention_days INTEGER NOT NULL, -- How long to retain (0 = indefinite)
    hard_delete_days INTEGER, -- After this many days, perform hard delete (NULL = never)
    reason TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO data_retention_policy (data_category, retention_days, hard_delete_days, reason) VALUES
('user_accounts', 365, 730, 'Active user retention 1 year, then 2 year archive before deletion'),
('contributions', 2555, 3650, 'Tax records 7 years + 1 year, then deletion after 10 years'),
('loans', 2555, 3650, 'Loan records 7 years + 1 year for dispute resolution'),
('meetings', 730, 1095, 'Meeting records 2 years + 1 year archive'),
('audit_logs', 1095, NULL, 'Keep indefinitely for compliance, but 3 year rolling window'),
('soft_deleted_data', 90, 180, 'Soft deleted data 3 months grace period, hard delete after 6 months')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- API ACCESS LOGS (Rate Limiting & Abuse Detection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_access_logs (
    access_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    ip_address INET,
    endpoint VARCHAR(255),
    http_method VARCHAR(10),
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_access_user ON api_access_logs(user_id);
CREATE INDEX idx_api_access_ip ON api_access_logs(ip_address);
CREATE INDEX idx_api_access_endpoint ON api_access_logs(endpoint);
CREATE INDEX idx_api_access_created_at ON api_access_logs(created_at DESC);

-- ============================================================================
-- BREACH NOTIFICATION LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS breach_notifications (
    breach_id SERIAL PRIMARY KEY,
    severity VARCHAR(50), -- CRITICAL, HIGH, MEDIUM, LOW
    description TEXT NOT NULL,
    affected_records INTEGER,
    affected_data_types TEXT[], -- Array of data types affected
    detected_at TIMESTAMP WITH TIME ZONE,
    reported_to_authority BOOLEAN DEFAULT false,
    dpia_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_breach_severity ON breach_notifications(severity);
CREATE INDEX idx_breach_detected ON breach_notifications(detected_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all data access and modifications - KDPA 2019 compliance';
COMMENT ON TABLE financial_audit_logs IS 'Immutable financial transaction audit trail';
COMMENT ON TABLE auth_audit_logs IS 'Authentication and authorization events';
COMMENT ON TABLE consent_audit_logs IS 'KDPA/GDPR consent management audit trail';
COMMENT ON TABLE data_export_logs IS 'Track all data subject access requests (DSAR) and data exports';
COMMENT ON TABLE deletion_audit_logs IS 'Track data deletion and right to be forgotten requests';
COMMENT ON TABLE data_retention_policy IS 'Define data retention periods for different data categories';

-- ============================================================================
-- MIGRATION LOG
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 013: Audit logging system created successfully';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - audit_logs (general data access)';
    RAISE NOTICE '  - financial_audit_logs (financial transactions)';
    RAISE NOTICE '  - auth_audit_logs (authentication events)';
    RAISE NOTICE '  - consent_audit_logs (consent management)';
    RAISE NOTICE '  - data_export_logs (DSAR responses)';
    RAISE NOTICE '  - deletion_audit_logs (deletions)';
    RAISE NOTICE '  - data_retention_policy (retention management)';
    RAISE NOTICE '  - api_access_logs (API access tracking)';
    RAISE NOTICE '  - breach_notifications (breach tracking)';
END $$;
