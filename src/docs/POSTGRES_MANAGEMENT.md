# PostgreSQL Database Management

This document provides guidance on managing the PostgreSQL database used in the Social Genius application, particularly in Docker environments.

## Docker PostgreSQL Connection Issues

If you encounter PostgreSQL connection issues when running the application in Docker, such as errors like "this.Client is not a constructor" or "Class constructor Pool cannot be invoked without 'new'", follow these steps:

### 1. Quick Fix using the fix-docker.sh Script

We've developed a script that applies all necessary fixes for PostgreSQL Docker connectivity:

```bash
./pg-fix-files/fix-docker.sh
```

This script:
- Copies specialized patch files to the right locations
- Applies constructor safety fixes for pg modules
- Creates a Docker-compatible environment
- Starts all containers with the fixes applied

### 2. Understanding the Issue

The connection issues occur due to incompatibilities between:
- Node.js ESM and CommonJS modules
- Constructor safety in the pg and pg-pool modules
- Docker container networking

Our fix addresses these issues by:
1. Ensuring constructor safety for Pool and Client classes
2. Preventing pg-native from loading and causing errors
3. Patching module loading to handle both calling patterns
4. Properly configuring Docker network communication

### 3. Manual Fix Steps

If you prefer to fix the issues manually:

1. Apply pg-patch.cjs to ensure Client is available on Pool.prototype:
   ```bash
   node pg-patch.cjs
   ```

2. Apply node_modules_patch.cjs to patch the actual module files:
   ```bash
   node node_modules_patch.cjs
   ```

3. Set environment variables for Docker:
   ```bash
   export NODE_PG_FORCE_NATIVE=0
   export RUNNING_IN_DOCKER=true
   ```

4. Start Docker with the proper network configuration:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

## Database Management

### Connecting to the Database

The PostgreSQL database runs on port 5435 for external connections:

- **Host**: localhost (or postgres in Docker network)
- **Port**: 5435 (mapped from 5432 in Docker)
- **Username**: postgres
- **Password**: postgres
- **Database**: socialgenius

You can use the included pgAdmin container (http://localhost:5050) for database management.

### Basic Management Commands

#### Start PostgreSQL Container
```bash
# Using Docker Compose
docker-compose -f docker-compose.dev.yml up -d postgres

# Or using the initialization script
./init-pgvector.sh
```

#### Connect to Database
```bash
# Connect to the PostgreSQL container
docker exec -it social-genius-postgres psql -U postgres -d socialgenius

# If using a different container name, first find it
docker ps | grep postgres
docker exec -it <container_name> psql -U postgres -d socialgenius
```

#### Check Database Status
```bash
# Check if container is running
docker ps | grep postgres

# Check database logs
docker logs social-genius-postgres
```

### Database Schema

The database includes these main tables:

- **documents**: Stores vectorized content with pgvector embeddings
- **businesses**: Business profiles and settings
- **users**: User accounts and authentication
- **memories**: Business memory records for AI analysis
- **sessions**: Authentication session storage

### Initializing the Database

The database is initialized with the schema in init-db.sql when the container starts. If you need to manually initialize or reset the database:

```bash
# Using the CLI
npm run init-db

# Or from Docker
docker-compose exec app npm run init-db
```

### Common SQL Queries

#### Collection Management
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

#### Document Exploration
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

### Backing Up and Restoring the Database

To backup the database:

```bash
docker-compose exec postgres pg_dump -U postgres socialgenius > backup.sql
```

To restore from a backup:

```bash
# First drop the existing database
docker-compose exec postgres psql -U postgres -c "DROP DATABASE socialgenius;"
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE socialgenius;"

# Then restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d socialgenius
```

## Troubleshooting Connectivity Issues

### Check Docker Networking

Ensure containers can communicate on the Docker network:

```bash
# Check Docker networks
docker network ls

# Inspect the network
docker network inspect social_genius_network
```

### Verify PostgreSQL is Running

Make sure the PostgreSQL container is running and healthy:

```bash
docker-compose ps postgres
docker-compose logs postgres
```

### Missing pgvector Extension
```sql
-- Check if pgvector is installed
SELECT * FROM pg_extension;

-- Install pgvector if missing
CREATE EXTENSION vector;
```

### Test Connection from App Container

Test the connection from inside the app container:

```bash
docker-compose exec app node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@postgres:5432/socialgenius'
});
pool.query('SELECT 1 as connection_test')
  .then(res => console.log('Connection successful:', res.rows))
  .catch(err => console.error('Connection error:', err))
  .finally(() => pool.end());
"
```

### Restart Containers

Sometimes a clean restart resolves connection issues:

```bash
docker-compose down
docker-compose up -d
```

## Advanced Configuration

### Changing PostgreSQL Version

To change the PostgreSQL version, update the image in docker-compose.yml:

```yaml
postgres:
  image: pgvector/pgvector:pg15  # Change from pg14 to pg15
```

### Performance Tuning

For production environments, consider these PostgreSQL performance optimizations:

```yaml
postgres:
  # Add these settings in environment section
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: socialgenius
    # Performance settings
    POSTGRES_INITDB_ARGS: "--data-checksums"
    POSTGRES_HOST_AUTH_METHOD: "trust"
  # Add this volume for PostgreSQL configuration
  volumes:
    - ./postgres.conf:/etc/postgresql/postgresql.conf
    - postgres_data:/var/lib/postgresql/data
  # Add custom command to use the config
  command: postgres -c 'config_file=/etc/postgresql/postgresql.conf'
```

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