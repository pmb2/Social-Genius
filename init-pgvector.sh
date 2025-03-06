#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}PostgreSQL with pgvector Initialization${NC}"
echo -e "${YELLOW}======================================${NC}"

# Check for required commands
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if PostgreSQL container is already running
POSTGRES_RUNNING=$(docker ps --filter "name=postgres" --format "{{.Names}}" | grep -c "postgres")

if [ $POSTGRES_RUNNING -eq 0 ]; then
    echo -e "${YELLOW}Starting PostgreSQL with pgvector...${NC}"
    
    # Check if we already have a docker-compose file
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.dev.yml" ]; then
        echo -e "${YELLOW}Using existing docker-compose configuration...${NC}"
        docker-compose -f docker-compose.dev.yml up -d postgres
    else
        echo -e "${YELLOW}No docker-compose file found. Starting standalone container...${NC}"
        docker run -d \
            --name social-genius-postgres \
            -p 5435:5432 \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgres \
            -e POSTGRES_DB=socialgenius \
            -v pgvector_data:/var/lib/postgresql/data \
            pgvector/pgvector:pg14
    fi
    
    # Wait for PostgreSQL to start
    echo -e "${YELLOW}Waiting for PostgreSQL to start...${NC}"
    sleep 5
fi

# Initialize database with schema
echo -e "${YELLOW}Initializing database schema...${NC}"

# Get container name
CONTAINER_NAME=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo -e "${RED}Error: PostgreSQL container not found.${NC}"
    exit 1
fi

# Check if init-db.sql exists
if [ ! -f "init-db.sql" ]; then
    echo -e "${RED}Error: init-db.sql file not found.${NC}"
    exit 1
fi

# Copy SQL file to container and execute
docker cp init-db.sql $CONTAINER_NAME:/tmp/init-db.sql
docker exec $CONTAINER_NAME psql -U postgres -d socialgenius -f /tmp/init-db.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Database schema initialized successfully!${NC}"
    
    # Update .env file if needed
    if [ -f ".env" ]; then
        if ! grep -q "DATABASE_URL=" .env; then
            echo -e "${YELLOW}Adding DATABASE_URL to .env file...${NC}"
            echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5435/socialgenius" >> .env
        fi
    else
        echo -e "${YELLOW}Creating .env file with database connection...${NC}"
        echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5435/socialgenius" > .env
    fi
    
    echo -e "${GREEN}Setup complete!${NC}"
    echo -e "${YELLOW}You can now use PostgreSQL with pgvector for your application.${NC}"
    echo -e "${YELLOW}Connection string: postgresql://postgres:postgres@localhost:5435/socialgenius${NC}"
else
    echo -e "${RED}Error initializing database schema.${NC}"
    exit 1
fi