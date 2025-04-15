#\!/bin/bash

# This script uses the fix-db-schema.sql file to fix the database schema issues
# It handles executing the SQL script against the Docker PostgreSQL container

echo "Fixing database schema..."

# Check if PostgreSQL container is running
if \! docker ps | grep -q "social-genius_postgres"; then
  echo "Error: PostgreSQL container is not running. Start it with 'docker-compose -f docker-compose.dev.yml up -d'"
  exit 1
fi

# Get PostgreSQL container ID
PG_CONTAINER=$(docker ps | grep social-genius_postgres | awk '{print $1}')
if [ -z "$PG_CONTAINER" ]; then
  echo "Error: Could not identify PostgreSQL container"
  exit 1
fi

echo "Found PostgreSQL container: $PG_CONTAINER"

# Copy SQL file to container
echo "Copying fix-db-schema-alter.sql to container..."
docker cp fix-db-schema-alter.sql "$PG_CONTAINER:/tmp/fix-db-schema-alter.sql"

# Execute SQL file
echo "Executing SQL file..."
docker exec "$PG_CONTAINER" psql -U postgres -d socialgenius -f /tmp/fix-db-schema-alter.sql

# Check if SQL execution was successful
if [ $? -eq 0 ]; then
  echo "Database schema fixed successfully\!"
else
  echo "Error: Failed to fix database schema. Check PostgreSQL logs for details."
  exit 1
fi

# Restart app container
echo "Restarting app container..."
docker-compose -f docker-compose.dev.yml restart app

echo "Done\!"
