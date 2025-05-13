-- Feature flags table to store configuration
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key VARCHAR(255) PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);

-- Initial feature flag data
INSERT INTO feature_flags (flag_key, config)
VALUES 
  ('use_google_business_api', '{"defaultValue": false, "environmentOverrides": {"production": false, "development": true}}'),
  ('google_auth_with_oauth', '{"defaultValue": false, "environmentOverrides": {"production": false, "development": true}}'),
  ('google_posts_with_api', '{"defaultValue": false, "environmentOverrides": {"production": false, "development": true}}'),
  ('google_reviews_with_api', '{"defaultValue": false, "environmentOverrides": {"production": false, "development": true}}')
ON CONFLICT (flag_key) DO NOTHING;