#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Starting database schema fix...${NC}"

# Run docker-compose with init-db.sql mounted
echo -e "${YELLOW}Creating business tables using init-db.sql...${NC}"
docker exec -i social-genius_postgres_1 psql -U postgres -d socialgenius -c "
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  business_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'noncompliant',
  description TEXT,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, user_id)
);"

# Create business_credentials table
echo -e "${YELLOW}Creating business_credentials table...${NC}"
docker exec -i social-genius_postgres_1 psql -U postgres -d socialgenius -c "
CREATE TABLE IF NOT EXISTS business_credentials (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL,
  credential_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, credential_type)
);"

# Verify the schema
echo -e "${YELLOW}Verifying schema...${NC}"
docker exec -i social-genius_postgres_1 psql -U postgres -d socialgenius -c "\d businesses"
docker exec -i social-genius_postgres_1 psql -U postgres -d socialgenius -c "\d business_credentials"

echo -e "${GREEN}Database schema has been repaired!${NC}"