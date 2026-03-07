-- Clean SQL for Chama 20 Happy Welfare
INSERT INTO welfare_config (chama_id, event_type, description, payout_amount, contribution_type, contribution_amount, is_active) 
VALUES 
(20, 'WEDDING', 'Celebration of a member wedding', 15000, 'AD_HOC', 100, true), 
(20, 'GRADUATION', 'Celebration of higher education completion', 10000, 'AD_HOC', 50, true)
ON CONFLICT (chama_id, event_type) DO UPDATE 
SET contribution_type = EXCLUDED.contribution_type, 
    payout_amount = EXCLUDED.payout_amount, 
    is_active = EXCLUDED.is_active;
