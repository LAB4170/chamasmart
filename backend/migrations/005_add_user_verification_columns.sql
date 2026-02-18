ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verification_code TEXT,
ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verification_attempts INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users(email_verification_token);

CREATE INDEX IF NOT EXISTS idx_users_phone_verification_code
  ON users(phone_verification_code);
