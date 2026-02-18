-- ============================================================================
-- MIGRATION: Auth Redesign - Multi-Option Signup
-- ============================================================================
-- This migration adds support for:
-- 1. Email + OTP signup
-- 2. Phone + OTP signup  
-- 3. Google OAuth
-- 4. Passwordless authentication
-- 5. Signup token tracking
-- ============================================================================

-- Add new columns to users table for auth methods
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS signup_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_passwordless BOOLEAN DEFAULT FALSE;

-- Create table for signup sessions (temporary, expires after 15 minutes)
CREATE TABLE IF NOT EXISTS signup_sessions (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    full_name VARCHAR(255),
    auth_method VARCHAR(20) NOT NULL, -- 'email', 'phone', 'google'
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    google_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '15 minutes',
    completed BOOLEAN DEFAULT FALSE
);

-- Create table for refresh tokens (for JWT refresh logic)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create table for OTP audit (track OTP attempts for security)
CREATE TABLE IF NOT EXISTS otp_audit (
    id SERIAL PRIMARY KEY,
    contact_info VARCHAR(255), -- email or phone
    contact_type VARCHAR(10), -- 'email' or 'phone'
    otp_code VARCHAR(6),
    success BOOLEAN,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create table for API keys (for secure API access)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    description TEXT,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_signup_sessions_token ON signup_sessions(token);
CREATE INDEX idx_signup_sessions_expires_at ON signup_sessions(expires_at);
CREATE INDEX idx_signup_sessions_email ON signup_sessions(email);
CREATE INDEX idx_signup_sessions_phone ON signup_sessions(phone_number);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX idx_otp_audit_contact_info ON otp_audit(contact_info);
CREATE INDEX idx_otp_audit_attempted_at ON otp_audit(attempted_at);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

CREATE INDEX idx_users_auth_method ON users(auth_method);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- Add constraint to ensure either email or phone exists
ALTER TABLE users 
ADD CONSTRAINT check_email_or_phone CHECK (email IS NOT NULL OR phone_number IS NOT NULL);

-- Create function to auto-delete expired signup sessions (runs on insert/update)
CREATE OR REPLACE FUNCTION cleanup_expired_signup_sessions()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM signup_sessions WHERE expires_at < NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to cleanup expired sessions
DROP TRIGGER IF EXISTS cleanup_signup_sessions_trigger ON signup_sessions;
CREATE TRIGGER cleanup_signup_sessions_trigger
    AFTER INSERT ON signup_sessions
    EXECUTE FUNCTION cleanup_expired_signup_sessions();

-- Add comment to document the new auth system
COMMENT ON TABLE signup_sessions IS 'Temporary signup sessions that expire after 15 minutes';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for maintaining long-lived sessions';
COMMENT ON TABLE otp_audit IS 'Audit log for OTP attempts (security monitoring)';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access to ChamaSmart';
