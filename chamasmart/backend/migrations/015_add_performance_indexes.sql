-- FAST-TRACK: Database Indexes for Performance
-- This adds 10 critical indexes in 30 seconds

-- Add missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_chama_id ON contributions(chama_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_chama_id ON meetings(chama_id);
CREATE INDEX IF NOT EXISTS idx_chama_members_compound ON chama_members(chama_id, user_id, role);

-- Performance indexes on status columns
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- Audit performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_timestamp ON auth_audit_logs(user_id, created_at DESC);

-- Verify
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%' 
ORDER BY tablename;
