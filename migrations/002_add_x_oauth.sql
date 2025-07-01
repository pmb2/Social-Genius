ALTER TABLE users ADD COLUMN x_account_id VARCHAR(255) UNIQUE;

CREATE TABLE linked_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    business_id VARCHAR(255) NOT NULL UNIQUE,
    x_account_id VARCHAR(255) NOT NULL UNIQUE,
    x_username VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
