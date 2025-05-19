-- Google OAuth Schema
-- Creates tables needed for storing Google OAuth tokens and states

-- Table for OAuth tokens (access tokens, refresh tokens)
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  business_id INTEGER,  -- May be null if created before business record
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  expiry_date BIGINT,  -- Unix timestamp in milliseconds
  encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);

-- Table for OAuth state management (prevent CSRF during flow)
CREATE TABLE IF NOT EXISTS google_oauth_states (
  id SERIAL PRIMARY KEY, 
  state_value TEXT NOT NULL,  -- The state parameter value
  state_data JSONB NOT NULL,  -- The data encoded in the state
  user_id INTEGER NOT NULL,   -- The user who initiated the flow
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,  -- Whether this state has been used
  UNIQUE(state_value)
);

-- Index for looking up states
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_value ON google_oauth_states(state_value);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_user ON google_oauth_tokens(user_id);

-- Add a column for token version if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'google_oauth_tokens' AND column_name = 'version'
  ) THEN
    ALTER TABLE google_oauth_tokens ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;
