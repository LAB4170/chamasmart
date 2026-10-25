-- Every chama has a code and every member a payment account number, so money paid to one shared paybill (or a chama's own) can be told apart.
CREATE TABLE IF NOT EXISTS chama_account_codes (
    chama_id BIGINT PRIMARY KEY,
    account_code VARCHAR(10) NOT NULL UNIQUE,
    channel VARCHAR(20) NOT NULL DEFAULT 'OWN_PAYBILL',
    shortcode VARCHAR(20),
    next_seq INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_chama_codes_shortcode ON chama_account_codes (shortcode);

CREATE TABLE IF NOT EXISTS member_accounts (
    account_number VARCHAR(20) PRIMARY KEY,
    chama_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    seq INTEGER NOT NULL,
    CONSTRAINT uq_member_account UNIQUE (chama_id, user_id)
);
