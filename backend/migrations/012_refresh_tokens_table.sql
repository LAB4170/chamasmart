-- Migration: 012_refresh_tokens_table.sql
-- Purpose: Add refresh tokens table for token refresh mechanism
-- Created: 2026-01-16

-- ============================================================================
-- CREATE REFRESH TOKENS TABLE
-- ============================================================================

DROP TABLE IF EXISTS refresh_tokens CASCADE;
CREATE TABLE refresh_tokens (
    token_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for looking up tokens by user and token value
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_token 
ON refresh_tokens(user_id, token) 
WHERE revoked_at IS NULL
;

-- Index for finding active tokens for a user
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active 
ON refresh_tokens(user_id) 
WHERE revoked_at IS NULL
;

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at 
ON refresh_tokens(expires_at) 
WHERE revoked_at IS NULL;

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for maintaining long-lived sessions';
COMMENT ON COLUMN refresh_tokens.token IS 'JWT refresh token (hashed in production, plain for now)';
COMMENT ON COLUMN refresh_tokens.user_agent IS 'Browser/app user agent for security audit';
COMMENT ON COLUMN refresh_tokens.ip_address IS 'IP address from which token was issued';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'Timestamp when token was revoked (logout)';

-- ============================================================================
-- LOG SUCCESSFUL MIGRATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Refresh tokens table created successfully';
    RAISE NOTICE 'Run cleanup function periodically: SELECT cleanup_expired_tokens();';
END $$;
