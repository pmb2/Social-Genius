-- Initialize database schema for Social Genius
-- This file is automatically executed when the PostgreSQL container starts

-- Ensure pgvector extension is available first
CREATE EXTENSION IF NOT EXISTS vector;
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    userId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name TEXT,
    profile_picture TEXT,
    phone_number TEXT,
    x_account_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create businesses table if it doesn't exist
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    businessId UUID UNIQUE NOT NULL,
    userId UUID NOT NULL REFERENCES users(userId) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    auth_status VARCHAR(50) DEFAULT 'pending',
    browser_instance VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE socialAccounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES users(userId) ON DELETE CASCADE,
  businessId UUID NOT NULL UNIQUE,
  platform VARCHAR(32) NOT NULL CHECK (platform IN ('x', 'google', 'facebook', 'instagram', 'linkedin')),
  providerAccountId VARCHAR(128) NOT NULL,
  accessToken TEXT NOT NULL,
  refreshToken TEXT,
  expiresAt TIMESTAMP,
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX ON socialAccounts (platform, providerAccountId, userId);
CREATE INDEX ON socialAccounts (userId);
CREATE INDEX ON socialAccounts (businessId);

-- Create or replace the function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$ language 'plpgsql';

-- Create triggers for all tables (only if tables exist)
DO $
BEGIN
    -- Create trigger for users table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create trigger for businesses table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') THEN
        DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
        CREATE TRIGGER update_businesses_updated_at
            BEFORE UPDATE ON businesses
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create trigger for social_accounts table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'socialAccounts') THEN
        DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON socialAccounts;
        CREATE TRIGGER update_social_accounts_updated_at
            BEFORE UPDATE ON socialAccounts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(userId);
CREATE INDEX IF NOT EXISTS idx_businesses_business_id ON businesses(businessId);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON socialAccounts(userId);
CREATE INDEX IF NOT EXISTS idx_social_accounts_business_id ON socialAccounts(businessId);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON socialAccounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_account_id ON socialAccounts(providerAccountId);

-- Encrypt sensitive tokens
CREATE OR REPLACE FUNCTION encryptToken(token TEXT) RETURNS TEXT AS $
BEGIN
  RETURN encode(encrypt(token::bytea, 'your-encryption-key', 'aes'), 'base64');
END;
$ LANGUAGE plpgsql;

-- Decrypt tokens
CREATE OR REPLACE FUNCTION decryptToken(encryptedToken TEXT) RETURNS TEXT AS $
BEGIN
  RETURN convert_from(decrypt(decode(encryptedToken, 'base64'), 'your-encryption-key', 'aes'), 'UTF8');
END;
$ LANGUAGE plpgsql;

