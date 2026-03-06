-- 044_welfare_emergency_drives.sql
-- Adds the two tables needed for the Emergency Drive (Harambee) feature.

-- Table to hold drive campaigns
CREATE TABLE IF NOT EXISTS welfare_emergency_drives (
    id             SERIAL PRIMARY KEY,
    chama_id       INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    beneficiary_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_by     INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    description    TEXT NOT NULL,
    target_amount  DECIMAL(15, 2) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to hold member contributions to drives
CREATE TABLE IF NOT EXISTS welfare_emergency_contributions (
    id         SERIAL PRIMARY KEY,
    drive_id   INTEGER NOT NULL REFERENCES welfare_emergency_drives(id) ON DELETE CASCADE,
    chama_id   INTEGER NOT NULL REFERENCES chamas(chama_id) ON DELETE CASCADE,
    member_id  INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount     DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_welfare_emergency_drives_chama 
  ON welfare_emergency_drives(chama_id, status);

CREATE INDEX IF NOT EXISTS idx_welfare_emergency_contributions_drive 
  ON welfare_emergency_contributions(drive_id);

-- Log
DO $$
BEGIN
    RAISE NOTICE 'Welfare Emergency Drives migration applied successfully';
END $$;
