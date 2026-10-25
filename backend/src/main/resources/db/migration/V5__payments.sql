-- Money-in plumbing: a currency for every chama, an idempotent log of every provider event, and platform subscriptions.
ALTER TABLE chamas ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'KES';

CREATE TABLE IF NOT EXISTS payment_events (
    event_id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(20) NOT NULL,
    provider_event_id VARCHAR(120) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    intent_id BIGINT,
    chama_id BIGINT,
    amount NUMERIC(15,2),
    currency VARCHAR(3),
    status VARCHAR(20) NOT NULL,
    note VARCHAR(300),
    payload TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_event UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_status ON payment_events (status, received_at);

CREATE TABLE IF NOT EXISTS chama_subscriptions (
    subscription_id BIGSERIAL PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    plan_code VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL,
    provider VARCHAR(20),
    provider_ref VARCHAR(120),
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chama_subscriptions_chama ON chama_subscriptions (chama_id);
