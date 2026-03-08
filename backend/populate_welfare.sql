-- Expanded default welfare events for Chama 20
-- Kenyan-culture inclusive event types
INSERT INTO welfare_config (chama_id, event_type, description, payout_amount, contribution_type, contribution_amount, is_active) 
VALUES 
(20, 'BEREAVEMENT',        'Death of a member or immediate family',     50000, 'PERIODIC', 200, true),
(20, 'HOSPITALIZATION',    'Hospital admission for more than 3 days',   20000, 'AD_HOC',   100, true),
(20, 'WEDDING',            'Member''s own wedding ceremony',            15000, 'AD_HOC',   100, true),
(20, 'GRADUATION',         'Member or dependent graduation ceremony',   10000, 'AD_HOC',    50, true),
(20, 'BABY_SHOWER',        'New born / baby naming ceremony',            8000, 'AD_HOC',    50, true),
(20, 'CIRCUMCISION',       'Cultural rite of passage ceremony',         10000, 'AD_HOC',   100, true),
(20, 'CHURCH_DEDICATION',  'Baby or church dedication ceremony',         5000, 'AD_HOC',    50, true),
(20, 'ACCIDENT',           'Road or work accident support',             20000, 'AD_HOC',   100, true),
(20, 'DISABILITY',         'Permanent disability support',              30000, 'AD_HOC',   200, true),
(20, 'FIRE_DISASTER',      'Fire or natural disaster loss',             25000, 'AD_HOC',   150, true),
(20, 'BUSINESS_LOSS',      'Significant business loss support',         10000, 'AD_HOC',    50, true)
ON CONFLICT (chama_id, event_type) DO UPDATE 
SET description = EXCLUDED.description,
    payout_amount = EXCLUDED.payout_amount,
    is_active = EXCLUDED.is_active;
