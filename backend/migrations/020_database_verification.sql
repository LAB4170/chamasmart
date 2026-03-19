-- ============================================================================
-- DATABASE VERIFICATION PLACEHOLDER
-- This migration was replaced with a no-op.
-- The original file contained diagnostic SELECT/EXPLAIN queries which cannot
-- run inside a transaction (as used by the migration runner).
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Database verification step skipped (diagnostic-only migration).';
END $$;
