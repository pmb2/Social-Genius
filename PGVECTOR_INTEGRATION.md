# PostgreSQL with pgvector Integration Guide

This guide provides detailed instructions for setting up and using PostgreSQL with pgvector as your vector database for Social Genius.

## About PostgreSQL with pgvector

PostgreSQL with the pgvector extension provides a unified solution for both regular data storage and vector embeddings. This simplifies your infrastructure by eliminating the need for a separate vector database like Qdrant.

### Key Benefits:
- **Open Source**: Completely FOSS (Free and Open Source Software)
- **SQL Interface**: Use familiar SQL queries for both regular data and vector similarity searches
- **Performance**: Excellent performance with appropriate indexing
- **Scalability**: Works from local development to production environments
- **Simplicity**: One database system to manage instead of two

## Installation Options

### 1. Docker Setup (Recommended)

The easiest way to get started is using Docker:

```bash
# Start PostgreSQL with pgvector using our script
./init-pgvector.sh
```

This will:
1. Start a PostgreSQL container with pgvector installed
2. Initialize the database with the necessary schema
3. Update your .env file with the connection string

### 2. Manual Installation

If you prefer to install PostgreSQL directly on your system:

1. Install PostgreSQL 14+ and the pgvector extension
2. Create a database and enable the vector extension:
   ```sql
   CREATE DATABASE socialgenius;
   \c socialgenius
   CREATE EXTENSION vector;
   ```
3. Run the initialization script:
   ```bash
   psql -U postgres -d socialgenius -f init-db.sql
   ```

## Using PostgreSQL in Your Application

The application is already configured to use PostgreSQL with pgvector. Here are the key components:

### Environment Variables

Make sure these variables are set in your `.env` file:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5435/socialgenius
```

If you're running your application inside Docker, use:

```
DATABASE_URL=postgresql://postgres:postgres@postgres:5435/socialgenius
```

### API Endpoints

The following endpoints are already set up to work with PostgreSQL:

- `/api/pg-vectorize`: Store documents with embeddings
- `/api/pg-retrieve`: Retrieve similar documents based on a query
- `/api/pg-delete-document`: Delete documents
- `/api/pg-process-pdf`: Process and store PDF documents
- `/api/pg-process-url`: Process and store content from URLs

### Database Service

The `postgres-service.ts` file contains the service that handles all database operations. It uses a singleton pattern to maintain a single database connection pool.

## Debugging & Troubleshooting

### Common Issues

1. **Connection Errors**:
   - Check if PostgreSQL is running: `docker ps | grep postgres`
   - Verify connection string in `.env` file
   - Ensure you're using the correct host (`localhost` or `postgres` in Docker)

2. **Missing Extension**:
   - Run `psql -U postgres -d socialgenius -c "SELECT * FROM pg_extension;"`
   - Make sure `vector` is in the list

3. **Performance Issues**:
   - Check if indexes were created properly
   - Consider adjusting the IVFFlat parameters for larger datasets

### Viewing Database Content

You can use pgAdmin (included in the development Docker setup) or directly query the database:

```bash
# Connect to database
docker exec -it [container_name] psql -U postgres -d socialgenius

# List collections
SELECT DISTINCT collection_name FROM documents;

# Count documents by collection
SELECT collection_name, COUNT(*) FROM documents GROUP BY collection_name;

# View most recent documents
SELECT id, collection_name, content, created_at FROM documents ORDER BY created_at DESC LIMIT 10;
```

## Production Considerations

For production deployments:

1. **Security**:
   - Use strong passwords instead of the default
   - Configure SSL/TLS connections
   - Implement proper user permissions

2. **Performance**:
   - Set up connection pooling (PgBouncer)
   - Tune PostgreSQL memory settings based on available RAM
   - Consider partitioning for very large collections

3. **Backup**:
   - Set up regular automated backups
   - Test restoration procedures

4. **Hosting Options**:
   - Self-hosted: Use a managed Kubernetes service
   - Cloud: Consider Supabase, Neon, AWS RDS, or Google Cloud SQL, all of which support pgvector