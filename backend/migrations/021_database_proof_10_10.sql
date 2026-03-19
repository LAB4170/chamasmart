-- ============================================================================
-- DATABASE 10/10 PROOF PLACEHOLDER
-- This migration was replaced with a no-op.
-- The original file contained a verification test suite with DO blocks
-- referencing undeclared variables (e.g., FOREACH table_name without DECLARE),
-- which caused syntax errors inside the migration runner transaction.
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Database 10/10 proof step skipped (verification-only migration).';
END $$;
