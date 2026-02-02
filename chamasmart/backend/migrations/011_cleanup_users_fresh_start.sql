-- Migration: 011_cleanup_users_fresh_start.sql
-- Purpose: Delete all user accounts to allow fresh registration
-- Created: 2026-01-16
-- Note: This migration is for development/testing purposes only

-- ============================================================================
-- DELETE ALL USER DATA IN CASCADE ORDER
-- ============================================================================

-- Delete audit logs
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN DELETE FROM audit_logs; END IF; END $$;

-- Delete notifications
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN DELETE FROM notifications; END IF; END $$;

-- Delete welfare data
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'welfare_claim_approvals') THEN DELETE FROM welfare_claim_approvals; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'welfare_claims') THEN DELETE FROM welfare_claims; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'welfare_contributions') THEN DELETE FROM welfare_contributions; END IF; END $$;

-- Delete loan repayments
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loan_repayments') THEN DELETE FROM loan_repayments; END IF; END $$;

-- Delete loans
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loans') THEN DELETE FROM loans; END IF; END $$;

-- Delete payouts
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payouts') THEN DELETE FROM payouts; END IF; END $$;

-- Delete ROSCA data
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rosca_payouts') THEN DELETE FROM rosca_payouts; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rosca_members') THEN DELETE FROM rosca_members; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rosca_roster') THEN DELETE FROM rosca_roster; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rosca_cycles') THEN DELETE FROM rosca_cycles; END IF; END $$;

-- Delete ASCA data  
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'asca_cycles') THEN DELETE FROM asca_cycles; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'asca_members') THEN DELETE FROM asca_members; END IF; END $$;

-- Delete meetings
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meetings') THEN DELETE FROM meetings; END IF; END $$;

-- Delete contributions
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contributions') THEN DELETE FROM contributions; END IF; END $$;

-- Delete proposals
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'proposals') THEN DELETE FROM proposals; END IF; END $$;

-- Delete join requests
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'join_requests') THEN DELETE FROM join_requests; END IF; END $$;

-- Delete invites
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chama_invites') THEN DELETE FROM chama_invites; END IF; END $$;

-- Delete chama members
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chama_members') THEN DELETE FROM chama_members; END IF; END $$;

-- Delete chamas
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chamas') THEN DELETE FROM chamas; END IF; END $$;

-- Delete all users (final step)
DO $$ BEGIN IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN DELETE FROM users; END IF; END $$;

-- ============================================================================
-- RESET SEQUENCES/AUTO-INCREMENT COUNTERS
-- ============================================================================

ALTER SEQUENCE users_user_id_seq RESTART WITH 1;
ALTER SEQUENCE chamas_chama_id_seq RESTART WITH 1;
ALTER SEQUENCE contributions_contribution_id_seq RESTART WITH 1;
ALTER SEQUENCE meetings_meeting_id_seq RESTART WITH 1;
ALTER SEQUENCE loans_loan_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_notification_id_seq RESTART WITH 1;

-- ============================================================================
-- LOG MIGRATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'User cleanup migration completed successfully';
    RAISE NOTICE 'All users, chamas, and related data have been deleted';
    RAISE NOTICE 'ID sequences have been reset';
    RAISE NOTICE 'Database is ready for fresh user registration';
END $$;
