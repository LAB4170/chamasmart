-- Migration: 014_password_security_enhancements.sql
-- Purpose: Add password security fields for KDPA compliance
-- Created: 2026-01-18

-- ============================================================================
-- ADD PASSWORD SECURITY COLUMNS TO USERS TABLE
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_method VARCHAR(50), -- SMS, EMAIL, AUTHENTICATOR
ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[], -- For MFA backup
ADD COLUMN IF NOT EXISTS password_history TEXT[]; -- Store last 5 password hashes

-- ============================================================================
-- ADD CONSENT COLUMNS TO USERS TABLE
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_processing_consent BOOLEAN DEFAULT false;

-- ============================================================================
-- CREATE PASSWORD POLICY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_policies (
    policy_id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    min_length INTEGER DEFAULT 12,
    require_uppercase BOOLEAN DEFAULT true,
    require_lowercase BOOLEAN DEFAULT true,
    require_numbers BOOLEAN DEFAULT true,
    require_special_chars BOOLEAN DEFAULT true,
    password_expiration_days INTEGER DEFAULT 90,
    prevent_reuse_count INTEGER DEFAULT 5, -- Prevent reusing last 5 passwords
    account_lockout_attempts INTEGER DEFAULT 5,
    account_lockout_duration_minutes INTEGER DEFAULT 15,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default policy
INSERT INTO password_policies (
    min_length, require_uppercase, require_lowercase, 
    require_numbers, require_special_chars, 
    password_expiration_days, account_lockout_attempts
) VALUES (
    12, true, true, true, true, 90, 5
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREATE PASSWORD BREACH CHECK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_breach_database (
    breach_id SERIAL PRIMARY KEY,
    password_hash VARCHAR(256) NOT NULL UNIQUE,
    breach_count INTEGER DEFAULT 1,
    severity VARCHAR(50), -- LOW, MEDIUM, HIGH, CRITICAL
    source VARCHAR(255), -- Which breach this came from
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_breach_hash ON password_breach_database(password_hash);

-- ============================================================================
-- CREATE DEVICE MANAGEMENT TABLE (for MFA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_devices (
    device_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- MOBILE, DESKTOP, TABLET
    device_identifier VARCHAR(255) UNIQUE,
    is_trusted BOOLEAN DEFAULT false,
    mfa_verified BOOLEAN DEFAULT false,
    mfa_verified_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_devices_user ON user_devices(user_id);
CREATE INDEX idx_user_devices_identifier ON user_devices(device_identifier);

-- ============================================================================
-- CREATE 2FA VERIFICATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor_sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    verification_code VARCHAR(10),
    method VARCHAR(50), -- SMS, EMAIL, AUTHENTICATOR
    verified BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_2fa_user ON two_factor_sessions(user_id);
CREATE INDEX idx_2fa_expires ON two_factor_sessions(expires_at);

-- ============================================================================
-- CREATE PRIVILEGE ESCALATION AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS privilege_escalation_logs (
    escalation_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE SET NULL,
    from_role VARCHAR(50),
    to_role VARCHAR(50),
    authorized_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_privilege_escalation_user ON privilege_escalation_logs(user_id);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE password_policies IS 'Password security policies for organization - KDPA compliance';
COMMENT ON TABLE password_breach_database IS 'Known breached passwords (HaveIBeenPwned integration)';
COMMENT ON TABLE user_devices IS 'Track user devices for MFA and suspicious login detection';
COMMENT ON TABLE two_factor_sessions IS 'Manage 2FA verification sessions';
COMMENT ON COLUMN users.password_attempts IS 'Count of failed password attempts (reset on success)';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether user has 2FA enabled';

-- ============================================================================
-- MIGRATION LOG
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 014: Password security enhancements created';
    RAISE NOTICE 'Added password security columns to users table';
    RAISE NOTICE 'Created password_policies table';
    RAISE NOTICE 'Created password_breach_database table';
    RAISE NOTICE 'Created user_devices table for MFA';
    RAISE NOTICE 'Created two_factor_sessions table';
    RAISE NOTICE 'Created privilege_escalation_logs table';
END $$;
