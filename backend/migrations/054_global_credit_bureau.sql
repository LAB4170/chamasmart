-- ============================================================================
-- MIGRATION: 054_global_credit_bureau.sql
-- Purpose: Add tables to support Chama Credit Bureau scoring and trend history
-- Created: 2026-03-12
-- ============================================================================

-- Score cache: one row per chama, refreshed on each score computation
CREATE TABLE IF NOT EXISTS chama_score_cache (
    cache_id       SERIAL PRIMARY KEY,
    chama_id       INTEGER NOT NULL UNIQUE REFERENCES chamas(chama_id) ON DELETE CASCADE,
    composite_score INTEGER NOT NULL DEFAULT 0 CHECK (composite_score BETWEEN 0 AND 100),
    tier           VARCHAR(20) NOT NULL DEFAULT 'FAIR'
                     CHECK (tier IN ('EXCELLENT', 'GOOD', 'FAIR', 'AT_RISK')),
    -- Dimension breakdown (0–100 each)
    contribution_score  INTEGER NOT NULL DEFAULT 0,
    loan_score          INTEGER NOT NULL DEFAULT 0,
    attendance_score    INTEGER NOT NULL DEFAULT 0,
    fund_growth_score   INTEGER NOT NULL DEFAULT 0,
    welfare_score       INTEGER NOT NULL DEFAULT 0,
    computed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Snapshot history: one row per chama per computation (weekly)
CREATE TABLE IF NOT EXISTS chama_health_snapshots (
    snapshot_id     SERIAL PRIMARY KEY,
    chama_id        INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    composite_score INTEGER NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
    tier            VARCHAR(20) NOT NULL,
    contribution_score  INTEGER,
    loan_score          INTEGER,
    attendance_score    INTEGER,
    fund_growth_score   INTEGER,
    welfare_score       INTEGER,
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_score_cache_chama ON chama_score_cache(chama_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_chama ON chama_health_snapshots(chama_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON chama_health_snapshots(chama_id, snapshot_date DESC);
