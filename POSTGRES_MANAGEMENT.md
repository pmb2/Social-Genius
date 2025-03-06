# PostgreSQL Database Management

This guide provides helpful commands for managing your PostgreSQL database with pgvector in the Social Genius application.

## Basic Management Commands

### Start PostgreSQL Container
```bash
# Using Docker Compose
docker-compose -f docker-compose.dev.yml up -d postgres

# Or using the initialization script
./init-pgvector.sh
```

### Connect to Database
```bash
# Connect to the PostgreSQL container
docker exec -it social-genius-postgres psql -U postgres -d socialgenius

# If using a different container name, first find it
docker ps | grep postgres
docker exec -it <container_name> psql -U postgres -d socialgenius
```

### Check Database Status
```bash
# Check if container is running
docker ps | grep postgres

# Check database logs
docker logs social-genius-postgres
```

## Common SQL Queries

### Collection Management
```sql
-- List all collections
SELECT DISTINCT collection_name FROM documents;

-- Count documents by collection
SELECT collection_name, COUNT(*) FROM documents GROUP BY collection_name;

-- See document types within a collection
SELECT 
  collection_name,
  metadata->>'source_type' as doc_type,
  COUNT(*) 
FROM documents 
GROUP BY collection_name, metadata->>'source_type';
```

### Document Exploration
```sql
-- View most recent documents
SELECT 
  id, 
  collection_name, 
  LEFT(content, 100) as preview, 
  created_at 
FROM documents 
ORDER BY created_at DESC 
LIMIT 10;

-- View document metadata
SELECT 
  id, 
  collection_name, 
  metadata 
FROM documents 
LIMIT 10;

-- Find documents by content
SELECT 
  id, 
  collection_name, 
  LEFT(content, 100) as preview 
FROM documents 
WHERE content ILIKE '%keyword%' 
LIMIT 10;
```

### Vector Operations
```sql
-- Find documents similar to a document with ID 123
-- (requires embedding to be present)
SELECT 
  id, 
  collection_name, 
  LEFT(content, 100) as preview, 
  1 - (embedding <=> (SELECT embedding FROM documents WHERE id = 123)) as similarity
FROM 
  documents
WHERE 
  collection_name = 'brand-alignment-rag'
  AND embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 5;
```

### Database Maintenance
```sql
-- Check table size
SELECT 
  pg_size_pretty(pg_total_relation_size('documents')) as total_size,
  pg_size_pretty(pg_relation_size('documents')) as table_size,
  pg_size_pretty(pg_indexes_size('documents')) as index_size;

-- Delete old documents
DELETE FROM documents WHERE created_at < NOW() - INTERVAL '30 days';

-- Remove documents from a specific collection
DELETE FROM documents WHERE collection_name = 'collection_name';

-- Vacuum the database to reclaim space
VACUUM FULL documents;
```

## Backup and Restore

### Backup
```bash
# From Docker
docker exec -it social-genius-postgres pg_dump -U postgres -d socialgenius > socialgenius_backup.sql

# Using pgAdmin
# Right-click on the database ’ Backup...
```

### Restore
```bash
# To Docker
cat socialgenius_backup.sql | docker exec -i social-genius-postgres psql -U postgres -d socialgenius

# Using pgAdmin
# Right-click on the database ’ Restore...
```

## Troubleshooting

### Missing pgvector Extension
```sql
-- Check if pgvector is installed
SELECT * FROM pg_extension;

-- Install pgvector if missing
CREATE EXTENSION vector;
```

### Recreate Index
```sql
-- Drop existing index if it's corrupted
DROP INDEX IF EXISTS documents_embedding_idx;

-- Recreate the index
CREATE INDEX documents_embedding_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);
```

### Connectivity Issues
```bash
# Test connectivity from inside the container
docker exec -it social-genius-postgres pg_isready

# Check PostgreSQL logs
docker logs social-genius-postgres
```

## Performance Tuning

For larger deployments, consider tuning these PostgreSQL settings:

```conf
# In postgresql.conf
shared_buffers = 2GB            # Increase for more memory caching
work_mem = 64MB                 # Increase for better query performance
maintenance_work_mem = 256MB    # Helps with vacuuming and indexing
effective_cache_size = 6GB      # Set to about 50-75% of available RAM
random_page_cost = 1.1          # Lower for SSD storage

# For pgvector specifically
# Adjust the number of lists in the IVFFlat index
# More lists = faster queries but less accurate
```