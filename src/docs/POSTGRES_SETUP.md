# PostgreSQL with pgvector Setup Guide

This guide covers setting up PostgreSQL with the pgvector extension for use as a unified database solution in the Social Genius application.

## Why PostgreSQL with pgvector?

- **Open Source**: Completely FOSS (Free and Open Source Software)
- **Unified Database**: One system for both regular data and vector embeddings
- **Performance**: Excellent performance for both traditional queries and vector similarity search
- **SQL Interface**: Use the power of SQL to query your vector data
- **Scalability**: Scales well from local development to production

## Prerequisites

- Docker (for easy setup) or
- PostgreSQL 14+ installed on your system

## Installation Methods

### Option 1: Using Docker (Recommended for Development)

1. Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg14
    ports:
      - "5435:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: socialgenius
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

2. Start the container:

```bash
docker-compose up -d
```

3. Update your `.env` file with the connection string:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5435/socialgenius
```

### Option 2: Using Existing PostgreSQL Installation

1. Install pgvector extension. For most package managers:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-14-pgvector

# macOS with Homebrew
brew install pgvector
```

2. Connect to PostgreSQL and create the database:

```bash
psql -U postgres
```

```sql
CREATE DATABASE socialgenius;
\c socialgenius
CREATE EXTENSION vector;
```

3. Update your `.env` file with the connection string:

```
DATABASE_URL=postgresql://username:password@localhost:5435/socialgenius
```

### Option 3: Using a Cloud Provider

Most major PostgreSQL providers now support pgvector:

- **Supabase**: Has built-in pgvector support
- **Neon**: Provides serverless PostgreSQL with pgvector
- **AWS RDS**: Supports pgvector through PostgreSQL 14+
- **Google Cloud SQL**: Supports pgvector in custom extensions

## Database Schema

The application creates the following schema automatically when the API is first used:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  collection_name TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS documents_collection_idx 
ON documents(collection_name);
```

## Making the Switch from Qdrant

The application supports both Qdrant and PostgreSQL backends. To switch to PostgreSQL:

1. Set up PostgreSQL with pgvector using one of the methods above
2. Update your frontend code to use the PostgreSQL-based API endpoints:
   - Change from `/api/retrieve` to `/api/pg-retrieve`
   - Change from `/api/vectorize` to `/api/pg-vectorize`
   - And so on for other endpoints
3. Remove Qdrant-specific environment variables from your `.env` file

## Querying the Database Directly

You can query the database directly to explore and manage your vector data:

```sql
-- See all collections
SELECT DISTINCT collection_name FROM documents;

-- Count documents by collection
SELECT collection_name, COUNT(*) FROM documents GROUP BY collection_name;

-- Find similar documents to a specific document (requires embedding)
SELECT 
  id, 
  content, 
  metadata, 
  1 - (embedding <=> (SELECT embedding FROM documents WHERE id = 123)) as similarity
FROM 
  documents
WHERE 
  collection_name = 'my_collection'
ORDER BY similarity DESC
LIMIT 5;

-- Delete old documents
DELETE FROM documents WHERE created_at < NOW() - INTERVAL '30 days';
```

## Performance Optimization

For large collections, consider these optimizations:

1. **Partitioning**: Partition the documents table by collection_name
2. **IVFFlat Parameters**: Adjust the `lists` parameter in the embedding index
3. **Connection Pooling**: Use PgBouncer for high-traffic applications

## Backup and Restore

Backup your vector database using standard PostgreSQL tools:

```bash
# Backup
pg_dump -U postgres -d socialgenius > socialgenius_backup.sql

# Restore
psql -U postgres -d socialgenius < socialgenius_backup.sql
```