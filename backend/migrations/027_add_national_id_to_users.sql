-- Add national_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR(20);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);

-- Add comment
COMMENT ON COLUMN users.national_id IS 'User national ID number for identity verification';
