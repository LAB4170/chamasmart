-- FAST-TRACK: Add Soft Deletes to Critical Tables
-- For GDPR/KDPA compliance - allow data recovery within retention period

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE chamas 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE loans 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Indexes for deleted filter
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(is_deleted) WHERE is_deleted = true;
CREATE INDEX IF NOT EXISTS idx_chamas_deleted ON chamas(is_deleted) WHERE is_deleted = true;
CREATE INDEX IF NOT EXISTS idx_loans_deleted ON loans(is_deleted) WHERE is_deleted = true;

-- Soft delete timestamp indexes for retention cleanup
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE is_deleted = true;
CREATE INDEX IF NOT EXISTS idx_chamas_deleted_at ON chamas(deleted_at) WHERE is_deleted = true;
CREATE INDEX IF NOT EXISTS idx_loans_deleted_at ON loans(deleted_at) WHERE is_deleted = true;

DO $$
BEGIN
    RAISE NOTICE 'Soft delete columns added to users, chamas, loans';
    RAISE NOTICE 'All queries should filter: WHERE is_deleted = false';
    RAISE NOTICE 'Retention cleanup scheduled via data_retention_policy table';
END $$;
