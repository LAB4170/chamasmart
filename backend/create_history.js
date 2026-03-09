const pool = require('./config/db');

const query = `
CREATE TABLE IF NOT EXISTS password_history (
    password_id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

pool.query(query)
    .then(() => {
        console.log('password_history table created successfully (no constraints)');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error creating table:', err);
        process.exit(1);
    });
