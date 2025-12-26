-- Optimizations for Hyperscale
-- Index for User Searches (Email and Phone are most common)
CREATE INDEX IF NOT EXISTS idx_users_email_phone ON users(email, phone_number);

-- Index for Chama Memberships (Join lookups are frequent)
CREATE INDEX IF NOT EXISTS idx_chama_members_active ON chama_members(chama_id, user_id) WHERE is_active = true;

-- Index for Contributions (Filtering by Cycle and Chama is critical for ROSCA)
CREATE INDEX IF NOT EXISTS idx_contributions_cycle ON contributions(chama_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions(user_id);

-- Index for ROSCA Roster (Payout calculations)
CREATE INDEX IF NOT EXISTS idx_rosca_roster_cycle ON rosca_roster(cycle_id);
