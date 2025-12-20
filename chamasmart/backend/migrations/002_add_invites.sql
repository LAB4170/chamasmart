-- Add invite codes table
CREATE TABLE IF NOT EXISTS chama_invites (
    invite_id SERIAL PRIMARY KEY,
    chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(user_id),
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invite_code ON chama_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_chama_invites ON chama_invites(chama_id);
