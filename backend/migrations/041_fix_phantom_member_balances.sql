-- Migration: Fix phantom member balances and chama fund
-- Only real COMPLETED contributions should be counted
-- Run once to fix stale/seed data in production

-- Recalculate all member total_contributions from actual contributions table
UPDATE chama_members cm
SET total_contributions = COALESCE((
  SELECT SUM(c.amount)
  FROM contributions c
  WHERE c.chama_id = cm.chama_id
    AND c.user_id = cm.user_id
    AND c.is_deleted = false
    AND c.status = 'COMPLETED'
), 0),
updated_at = NOW();

-- Recalculate all chama current_fund from actual contributions table
UPDATE chamas c
SET current_fund = COALESCE((
  SELECT SUM(contrib.amount)
  FROM contributions contrib
  WHERE contrib.chama_id = c.chama_id
    AND contrib.is_deleted = false
    AND contrib.status = 'COMPLETED'
), 0),
updated_at = NOW();
