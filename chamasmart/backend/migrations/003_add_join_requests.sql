-- Migration: Add Public/Private Chamas and Join Request System
-- Run this script to add new features

-- 1. Add visibility column to chamas table
ALTER TABLE chamas 
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'PRIVATE' 
CHECK (visibility IN ('PUBLIC', 'PRIVATE'));

-- Update existing chamas to PRIVATE
UPDATE chamas SET visibility = 'PRIVATE' WHERE visibility IS NULL;

-- 2. Create join_requests table
CREATE TABLE IF NOT EXISTS join_requests (
    request_id SERIAL PRIMARY KEY,
    chama_id INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    message TEXT,
    reviewed_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    CONSTRAINT unique_pending_request UNIQUE(chama_id, user_id, status)
);

-- Create indexes for join_requests
CREATE INDEX IF NOT EXISTS idx_join_requests_chama ON join_requests(chama_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);

-- 3. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(255),
    related_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 4. Add comment for documentation
COMMENT ON COLUMN chamas.visibility IS 'PUBLIC chamas are discoverable and joinable via request, PRIVATE chamas require invite codes';
COMMENT ON TABLE join_requests IS 'Stores join requests for public chamas';
COMMENT ON TABLE notifications IS 'Stores user notifications for various events';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '✅ Added visibility column to chamas';
    RAISE NOTICE '✅ Created join_requests table';
    RAISE NOTICE '✅ Created notifications table';
END $$;
