-- Two-factor authentication (authenticator app). Safe to run on databases where Hibernate already created the tables.
CREATE TABLE IF NOT EXISTS user_mfa (
    user_id BIGINT PRIMARY KEY,
    secret VARCHAR(512) NOT NULL,
    enabled BOOLEAN NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    last_used_step BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON mfa_recovery_codes (user_id);
