#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Setting up migrations and dependencies for Social Genius...${NC}"

# Create screenshots directory for browser-use-api
echo -e "${YELLOW}Creating screenshots directory...${NC}"
mkdir -p browser-use-api/screenshots
chmod 777 browser-use-api/screenshots

# Install new npm dependencies
echo -e "${YELLOW}Installing new npm dependencies...${NC}"
npm install @stripe/react-stripe-js @stripe/stripe-js --save

# Check if the database is running
echo -e "${YELLOW}Checking if the database is running...${NC}"
if ! docker ps | grep -q postgres; then
  echo -e "${RED}Error: PostgreSQL container is not running. Please start the application first.${NC}"
  echo -e "${YELLOW}You can start the app by running: ./start-dev.sh${NC}"
  exit 1
fi

# Run the database migrations
echo -e "${YELLOW}Running database migrations...${NC}"

# Get the container ID of the Postgres container
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.ID}}")

if [ -z "$POSTGRES_CONTAINER" ]; then
  echo -e "${RED}Error: PostgreSQL container not found.${NC}"
  exit 1
fi

# Copy the migration file to the container
echo -e "${YELLOW}Copying migration file to the container...${NC}"
docker cp database-migrations/add-google-credentials.sql $POSTGRES_CONTAINER:/tmp/

# Execute the migration
echo -e "${YELLOW}Executing the migration...${NC}"
docker exec $POSTGRES_CONTAINER psql -U postgres -d socialgenius -f /tmp/add-google-credentials.sql

# Check if the migration was successful
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Database migration completed successfully!${NC}"
else
  echo -e "${RED}Error: Database migration failed.${NC}"
  exit 1
fi

# Create directory for lib/subscription if it doesn't exist
if [ ! -d "lib/subscription" ]; then
  echo -e "${YELLOW}Creating subscription directory...${NC}"
  mkdir -p lib/subscription
fi

# Create directory for lib/browser-automation if it doesn't exist
if [ ! -d "lib/browser-automation" ]; then
  echo -e "${YELLOW}Creating browser-automation directory...${NC}"
  mkdir -p lib/browser-automation
fi

# Create directory for components/subscription if it doesn't exist
if [ ! -d "components/subscription" ]; then
  echo -e "${YELLOW}Creating subscription components directory...${NC}"
  mkdir -p components/subscription
fi

# Create the database migrations directory if it doesn't exist
if [ ! -d "database-migrations" ]; then
  echo -e "${YELLOW}Creating database migrations directory...${NC}"
  mkdir -p database-migrations
fi

echo -e "${GREEN}Setup complete! You can now run the application with ./start-dev.sh${NC}"
echo -e "${YELLOW}If you need to rebuild the application, run ./rebuild-dev.sh${NC}"