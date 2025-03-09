-- PostgreSQL initialization script for Social Genius
-- This script creates all necessary tables, indexes, and extensions

-- Enable pgvector extension for storing and searching vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table for storing vectorized content
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  collection_name TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create memories table for storing business memories
CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  is_completed BOOLEAN,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create businesses table to store business profiles
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  business_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'noncompliant',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, user_id)
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster vector similarity search for documents
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index on collection_name for faster filtering
CREATE INDEX IF NOT EXISTS documents_collection_idx 
ON documents(collection_name);

-- Add metadata index for JSONB queries
CREATE INDEX IF NOT EXISTS documents_metadata_idx
ON documents USING GIN(metadata);

-- Create index for faster vector similarity search for memories
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index on memory_type and business_id for faster filtering
CREATE INDEX IF NOT EXISTS memories_type_idx 
ON memories(memory_type);

CREATE INDEX IF NOT EXISTS memories_business_idx 
ON memories(business_id);

-- Create index on user email for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx 
ON users(email);

-- Create index on business user_id for faster lookups
CREATE INDEX IF NOT EXISTS businesses_user_id_idx 
ON businesses(user_id);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS sessions_id_idx 
ON sessions(session_id);

-- Create view for collection statistics
CREATE OR REPLACE VIEW collection_stats AS
SELECT 
  collection_name,
  COUNT(*) as document_count,
  MIN(created_at) as oldest_document,
  MAX(created_at) as newest_document
FROM 
  documents
GROUP BY 
  collection_name;

-- Enable a test user for development (email: test@example.com, password: password123)
-- The password hash is for the password 'password123'
INSERT INTO users (email, password_hash, name, created_at)
VALUES ('test@example.com', '92d9a320cb6af958f5a9c7b93908a402:2ea7d7e78c63ec2e8e25516de994193e4fa19ea1b59818b6e4bcee6435df29e34c9dc95a9028ee0c7a3cd326578d06ed8a197ed9c44836b9b211741bc68c8d41', 'Test User', NOW())
ON CONFLICT (email) DO NOTHING;