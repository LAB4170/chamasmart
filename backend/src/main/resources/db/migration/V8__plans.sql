-- Platform plans. The prices below are placeholders for the owner to set; changing a price is one UPDATE, no code change.
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_code VARCHAR(30) PRIMARY KEY,
    display_name VARCHAR(60) NOT NULL,
    max_members INTEGER NOT NULL,
    price NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    interval_months INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO subscription_plans (plan_code, display_name, max_members, price) VALUES
    ('STARTER', 'Starter', 30, 0),
    ('GROWTH', 'Growth', 150, 1500),
    ('PORTFOLIO', 'Portfolio', 1000, 5000)
ON CONFLICT (plan_code) DO NOTHING;
