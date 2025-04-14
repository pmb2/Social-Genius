-- Create directory for migrations if it doesn't exist (this is a comment, not SQL)
-- mkdir -p database-migrations

-- Add columns for Google credentials to businesses table
ALTER TABLE IF EXISTS businesses
ADD COLUMN IF NOT EXISTS google_auth_status VARCHAR(50) DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_credentials_encrypted TEXT,
ADD COLUMN IF NOT EXISTS google_auth_timestamp TIMESTAMP;

-- Create task_logs table to track browser-use-api tasks
CREATE TABLE IF NOT EXISTS task_logs (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL,
    business_id VARCHAR(255) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    result TEXT,
    error TEXT,
    screenshot_path TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_logs_business_id ON task_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task_logs table
DROP TRIGGER IF EXISTS set_timestamp ON task_logs;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON task_logs
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();