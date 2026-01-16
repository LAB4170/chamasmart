-- Migration: 011_cleanup_users_fresh_start.sql
-- Purpose: Delete all user accounts to allow fresh registration
-- Created: 2026-01-16
-- Note: This migration is for development/testing purposes only

-- ============================================================================
-- DELETE ALL USER DATA IN CASCADE ORDER
-- ============================================================================

-- Delete audit logs (no foreign keys, safe to delete)
DELETE FROM audit_logs WHERE 1=1;

-- Delete notifications
DELETE FROM notifications WHERE 1=1;

-- Delete welfare data
DELETE FROM welfare_claim_approvals WHERE 1=1;
DELETE FROM welfare_claims WHERE 1=1;
DELETE FROM welfare_contributions WHERE 1=1;

-- Delete loan repayments
DELETE FROM loan_repayments WHERE 1=1;

-- Delete loans
DELETE FROM loans WHERE 1=1;

-- Delete payouts
DELETE FROM payouts WHERE 1=1;

-- Delete ROSCA data
DELETE FROM rosca_payouts WHERE 1=1;
DELETE FROM rosca_members WHERE 1=1;

-- Delete ASCA data  
DELETE FROM asca_cycles WHERE 1=1;
DELETE FROM asca_members WHERE 1=1;

-- Delete meetings
DELETE FROM meetings WHERE 1=1;

-- Delete contributions
DELETE FROM contributions WHERE 1=1;

-- Delete proposals
DELETE FROM proposals WHERE 1=1;

-- Delete join requests
DELETE FROM join_requests WHERE 1=1;

-- Delete invites
DELETE FROM chama_invites WHERE 1=1;

-- Delete chama members
DELETE FROM chama_members WHERE 1=1;

-- Delete chamas
DELETE FROM chamas WHERE 1=1;

-- Delete all users (final step)
DELETE FROM users WHERE 1=1;

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
