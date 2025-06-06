-- Feature Flags Schema
-- Creates tables needed for storing feature flag configuration

-- Table for feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  flag_key VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(flag_key)
);

-- Insert default feature flags if they don't exist
INSERT INTO feature_flags (flag_key, config)
VALUES ('google_auth_with_oauth', '{"defaultValue":true,"environmentOverrides":{"production":true,"development":true,"staging":true}}')
ON CONFLICT (flag_key) DO NOTHING;

INSERT INTO feature_flags (flag_key, config)
VALUES ('use_google_business_api', '{"defaultValue":true,"environmentOverrides":{"production":true,"development":true,"staging":true}}')
ON CONFLICT (flag_key) DO NOTHING;

INSERT INTO feature_flags (flag_key, config)
VALUES ('enable_new_dashboard', '{"defaultValue":false,"environmentOverrides":{"production":false,"development":true,"staging":true}}')
ON CONFLICT (flag_key) DO NOTHING;
