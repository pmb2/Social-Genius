-- Enable pgvector extension
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

-- Create index for faster vector similarity search
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

-- Grant permissions if running in a multi-user environment
-- GRANT ALL PRIVILEGES ON TABLE documents TO your_app_user;
-- GRANT ALL PRIVILEGES ON SEQUENCE documents_id_seq TO your_app_user;
-- GRANT SELECT ON collection_stats TO your_app_user;