-- Google OAuth tokens table
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, business_id)
);

-- Google Business account data
CREATE TABLE IF NOT EXISTS google_business_accounts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  google_account_id TEXT NOT NULL,
  google_account_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id)
);

-- Google Business locations
CREATE TABLE IF NOT EXISTS google_business_locations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  google_account_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  address JSON,
  phone_number TEXT,
  primary_category TEXT,
  website_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_primary BOOLEAN DEFAULT FALSE,
  UNIQUE(business_id, location_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_user_id ON google_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_tokens_business_id ON google_oauth_tokens(business_id);
CREATE INDEX IF NOT EXISTS idx_google_business_accounts_business_id ON google_business_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_google_business_locations_business_id ON google_business_locations(business_id);
CREATE INDEX IF NOT EXISTS idx_google_business_locations_account_id ON google_business_locations(google_account_id);