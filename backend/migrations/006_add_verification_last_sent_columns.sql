ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verification_last_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verification_last_sent_at TIMESTAMPTZ;
