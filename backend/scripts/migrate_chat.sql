-- migrate_chat.sql
-- Description: Creates the foundation for real-time messaging

CREATE TABLE IF NOT EXISTS chat_channels (
    channel_id SERIAL PRIMARY KEY,
    chama_id INT REFERENCES chamas(chama_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('group', 'support', 'direct')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id SERIAL PRIMARY KEY,
    channel_id INT REFERENCES chat_channels(channel_id) ON DELETE CASCADE,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'system')),
    content TEXT,
    media_url VARCHAR(1000),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast retrieval of latest messages in a channel
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, created_at DESC);
