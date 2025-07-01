-- PostgreSQL initialization script for Social Genius
-- This version ensures proper table creation order and consistent schema

-- Enable pgvector extension for vector embeddings (added first to avoid dependency issues)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table first as it's referenced by other tables
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  profile_picture TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  x_account_id VARCHAR(255) UNIQUE
);

-- Create a new table to store linked X.com accounts for each user.
CREATE TABLE IF NOT EXISTS linked_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id VARCHAR(255) NOT NULL UNIQUE,
    x_account_id VARCHAR(255) NOT NULL UNIQUE,
    x_username VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sessions table which depends on users
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  data JSONB
);

-- Create businesses table which depends on users
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  business_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  description TEXT,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  google_auth_status VARCHAR(50) DEFAULT 'not_connected',
  google_email VARCHAR(255),
  google_credentials_encrypted TEXT,
  google_auth_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, user_id)
);

-- Create documents table which depends on users and businesses
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  document_id TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses(business_id) ON DELETE CASCADE,
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create document chunks table for vector storage
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id TEXT REFERENCES documents(document_id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create memories table for business memory storage
CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create business_credentials table for storing sensitive credentials
CREATE TABLE IF NOT EXISTS business_credentials (
  id SERIAL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL,
  credential_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, credential_type)
);

-- Create task_logs table for browser automation tasks
CREATE TABLE IF NOT EXISTS task_logs (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) NOT NULL,
  business_id VARCHAR(255) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  result TEXT,
  error TEXT,
  screenshot_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'success', 'warning', 'alert')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  flag_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create google_oauth_credentials table
CREATE TABLE IF NOT EXISTS google_oauth_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses(business_id) ON DELETE CASCADE,
  oauth_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  email VARCHAR(255),
  scopes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups

-- Users indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_session_id_idx ON sessions(session_id);

-- Businesses indexes
CREATE INDEX IF NOT EXISTS businesses_user_id_idx ON businesses(user_id);
CREATE INDEX IF NOT EXISTS businesses_business_id_idx ON businesses(business_id);

-- Documents indexes
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_business_id_idx ON documents(business_id);
CREATE INDEX IF NOT EXISTS documents_document_id_idx ON documents(document_id);

-- Document chunks indexes
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);

-- Memories indexes
CREATE INDEX IF NOT EXISTS memories_business_id_idx ON memories(business_id);
CREATE INDEX IF NOT EXISTS memories_memory_type_idx ON memories(memory_type);

-- Task logs indexes
CREATE INDEX IF NOT EXISTS task_logs_business_id_idx ON task_logs(business_id);
CREATE INDEX IF NOT EXISTS task_logs_task_id_idx ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS task_logs_status_idx ON task_logs(status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);

-- For vector similarity searches, create IVFFlat indexes
DO $$
BEGIN
  -- Only create these indexes if they don't already exist
  -- since they're expensive to create
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'documents_embedding_idx'
  ) THEN
    -- Documents embedding index
    BEGIN
      CREATE INDEX documents_embedding_idx 
      ON documents 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating documents_embedding_idx: %', SQLERRM;
    END;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'document_chunks_embedding_idx'
  ) THEN
    -- Document chunks embedding index
    BEGIN
      CREATE INDEX document_chunks_embedding_idx 
      ON document_chunks 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating document_chunks_embedding_idx: %', SQLERRM;
    END;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'memories_embedding_idx'
  ) THEN
    -- Memories embedding index
    BEGIN
      CREATE INDEX memories_embedding_idx 
      ON memories 
      USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating memories_embedding_idx: %', SQLERRM;
    END;
  END IF;
END $$;