-- Migration: Add Firebase UID and Auth Provider columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'password';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Index for faster lookups by Firebase UID
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Comment for clarity
COMMENT ON COLUMN users.firebase_uid IS 'Unique identifier from Firebase Authentication';
COMMENT ON COLUMN users.auth_provider IS 'Identity provider used (e.g., password, google.com, phone)';
