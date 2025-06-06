-- Business Schema
-- Tables needed for Google Business Profile integration

-- Main businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  business_id VARCHAR(100) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'local',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Google Business Profile Accounts
CREATE TABLE IF NOT EXISTS google_business_accounts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  google_account_id VARCHAR(255) NOT NULL,
  google_account_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, google_account_id)
);

-- Google Business Profile Locations
CREATE TABLE IF NOT EXISTS google_business_locations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  google_account_id VARCHAR(255) NOT NULL,
  location_id VARCHAR(255) NOT NULL,
  location_name VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, location_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_google_business_accounts_business_id ON google_business_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_google_business_locations_business_id ON google_business_locations(business_id);