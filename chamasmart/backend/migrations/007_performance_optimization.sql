-- ChamaSmart Phase 2: Advanced Performance Indexes
-- This migration adds composite indexes, partial indexes, and optimizations
-- for handling billions of records with sub-100ms response times

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Contributions: Most common queries filter by chama_id and date
CREATE INDEX IF NOT EXISTS idx_contributions_chama_date 
ON contributions(chama_id, contribution_date DESC);

-- Contributions: User contribution history
CREATE INDEX IF NOT EXISTS idx_contributions_user_date 
ON contributions(user_id, contribution_date DESC);

-- Contributions: Amount-based queries (for analytics)
CREATE INDEX IF NOT EXISTS idx_contributions_amount 
ON contributions(chama_id, amount, contribution_date DESC);

-- ============================================================================
-- PARTIAL INDEXES FOR ACTIVE RECORDS
-- ============================================================================

-- Only index active chama members (reduces index size by ~50%)
CREATE INDEX IF NOT EXISTS idx_chama_members_active 
ON chama_members(chama_id, user_id, role) 
WHERE is_active = true;

-- Only index active chamas
CREATE INDEX IF NOT EXISTS idx_chamas_active 
ON chamas(chama_id, chama_type, created_at DESC) 
WHERE is_active = true;

-- Only index pending/active loans
CREATE INDEX IF NOT EXISTS idx_loans_active 
ON loans(chama_id, borrower_id, status, due_date) 
WHERE status IN ('PENDING', 'ACTIVE');

-- Only index pending payouts
CREATE INDEX IF NOT EXISTS idx_payouts_pending 
ON payouts(chama_id, user_id, payout_date) 
WHERE status = 'PENDING';

-- ============================================================================
-- COVERING INDEXES (Include commonly selected columns)
-- ============================================================================

-- Chama members with role information (avoids table lookup)
CREATE INDEX IF NOT EXISTS idx_chama_members_covering 
ON chama_members(chama_id, user_id) 
INCLUDE (role, join_date, total_contributions, is_active);

-- Meetings with total collected (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_meetings_covering 
ON meetings(chama_id, meeting_date DESC) 
INCLUDE (total_collected, recorded_by);

-- ============================================================================
-- GIN INDEXES FOR JSONB COLUMNS
-- ============================================================================

-- Constitution config for searching by rules
CREATE INDEX IF NOT EXISTS idx_chamas_constitution_gin 
ON chamas USING GIN (constitution_config);

-- ============================================================================
-- INDEXES FOR FOREIGN KEY RELATIONSHIPS
-- ============================================================================

-- Ensure all foreign keys have indexes for JOIN performance
CREATE INDEX IF NOT EXISTS idx_contributions_recorded_by 
ON contributions(recorded_by);

CREATE INDEX IF NOT EXISTS idx_loans_approved_by 
ON loans(approved_by);

CREATE INDEX IF NOT EXISTS idx_loan_repayments_recorded_by 
ON loan_repayments(recorded_by);

CREATE INDEX IF NOT EXISTS idx_meetings_recorded_by 
ON meetings(recorded_by);

-- ============================================================================
-- EXPRESSION INDEXES FOR COMMON CALCULATIONS
-- ============================================================================



-- Index on outstanding loan amount
CREATE INDEX IF NOT EXISTS idx_loans_outstanding 
ON loans(chama_id, (total_repayable - amount_paid)) 
WHERE status = 'ACTIVE';

-- ============================================================================
-- MATERIALIZED VIEWS FOR DASHBOARD QUERIES
-- ============================================================================

-- Drop existing if any
DROP MATERIALIZED VIEW IF EXISTS mv_chama_statistics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_user_statistics CASCADE;

-- Chama statistics (refreshed hourly)
CREATE MATERIALIZED VIEW mv_chama_statistics AS
SELECT 
    c.chama_id,
    c.chama_name,
    c.chama_type,
    c.created_at,
    COUNT(DISTINCT cm.user_id) FILTER (WHERE cm.is_active = true) as active_members,
    COUNT(DISTINCT cm.user_id) as total_members,
    COALESCE(SUM(cont.amount), 0) as total_contributions,
    COALESCE(SUM(cont.amount) FILTER (
        WHERE cont.contribution_date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) as contributions_last_30_days,
    COALESCE(SUM(l.loan_amount), 0) as total_loans_issued,
    COALESCE(SUM(l.total_repayable - l.amount_paid), 0) as outstanding_loans,
    COALESCE(SUM(p.amount), 0) as total_payouts,
    COUNT(DISTINCT m.meeting_id) as total_meetings,
    MAX(m.meeting_date) as last_meeting_date,
    c.current_fund
FROM chamas c
LEFT JOIN chama_members cm ON c.chama_id = cm.chama_id
LEFT JOIN contributions cont ON c.chama_id = cont.chama_id
LEFT JOIN loans l ON c.chama_id = l.chama_id
LEFT JOIN payouts p ON c.chama_id = p.chama_id
LEFT JOIN meetings m ON c.chama_id = m.chama_id
WHERE c.is_active = true
GROUP BY c.chama_id, c.chama_name, c.chama_type, c.created_at, c.current_fund;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX ON mv_chama_statistics(chama_id);

-- User statistics (refreshed hourly)
CREATE MATERIALIZED VIEW mv_user_statistics AS
SELECT 
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(DISTINCT cm.chama_id) FILTER (WHERE cm.is_active = true) as active_chamas,
    COALESCE(SUM(cont.amount), 0) as total_contributions,
    COALESCE(SUM(cont.amount) FILTER (
        WHERE cont.contribution_date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) as contributions_last_30_days,
    COUNT(DISTINCT l.loan_id) FILTER (WHERE l.status = 'ACTIVE') as active_loans,
    COALESCE(SUM(l.total_repayable - l.amount_paid) FILTER (
        WHERE l.status = 'ACTIVE'
    ), 0) as outstanding_loan_amount,
    u.created_at
FROM users u
LEFT JOIN chama_members cm ON u.user_id = cm.user_id
LEFT JOIN contributions cont ON u.user_id = cont.user_id
LEFT JOIN loans l ON u.user_id = l.borrower_id
GROUP BY u.user_id, u.email, u.first_name, u.last_name, u.created_at;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX ON mv_user_statistics(user_id);

-- ============================================================================
-- FUNCTIONS FOR MATERIALIZED VIEW REFRESH
-- ============================================================================

-- Refresh chama statistics
CREATE OR REPLACE FUNCTION refresh_chama_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_chama_statistics;
END;
$$ LANGUAGE plpgsql;

-- Refresh user statistics
CREATE OR REPLACE FUNCTION refresh_user_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_user_statistics;
END;
$$ LANGUAGE plpgsql;

-- Refresh all statistics
CREATE OR REPLACE FUNCTION refresh_all_statistics()
RETURNS void AS $$
BEGIN
    PERFORM refresh_chama_statistics();
    PERFORM refresh_user_statistics();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE users;
ANALYZE chamas;
ANALYZE chama_members;
ANALYZE contributions;
ANALYZE meetings;
ANALYZE loans;
ANALYZE loan_repayments;
ANALYZE payouts;

-- ============================================================================
-- VACUUM TABLES TO RECLAIM SPACE
-- ============================================================================



-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_contributions_chama_date IS 'Optimizes queries filtering contributions by chama and date range';
COMMENT ON INDEX idx_chama_members_active IS 'Partial index for active members only - reduces index size';
COMMENT ON MATERIALIZED VIEW mv_chama_statistics IS 'Pre-aggregated chama statistics - refresh hourly';
COMMENT ON FUNCTION refresh_all_statistics IS 'Refreshes all materialized views - schedule via cron';
