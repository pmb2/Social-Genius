#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# Project name for container naming
PROJECT_NAME="social-genius"

echo -e "${YELLOW}Rebuilding Social Genius in development mode...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${YELLOW}Docker is not running. Attempting to start Docker...${NC}"
  
  # Check if we're on macOS and try to start Docker Desktop
  if [ -d "/Applications/Docker.app" ]; then
    echo -e "${YELLOW}Starting Docker Desktop...${NC}"
    open -a Docker
    
    # Wait for Docker to start (max 60 seconds)
    echo -e "${YELLOW}Waiting for Docker to start (this may take a moment)...${NC}"
    for i in {1..60}; do
      sleep 1
      if docker info > /dev/null 2>&1; then
        echo -e "${GREEN}Docker started successfully!${NC}"
        break
      fi
      if [ $i -eq 60 ]; then
        echo -e "${RED}Timed out waiting for Docker to start. Please start Docker manually and try again.${NC}"
        exit 1
      fi
    done
  else
    echo -e "${RED}Docker Desktop not found. Please install Docker and try again.${NC}"
    exit 1
  fi
fi

# Stop existing containers but preserve volumes for database persistence
echo -e "${YELLOW}Stopping all existing containers but preserving database volumes...${NC}"
docker-compose -f docker-compose.dev.yml down --remove-orphans # Removed the -v flag to preserve volumes

# Remove any stale networks
echo -e "${YELLOW}Removing any stale Docker networks...${NC}"
docker network prune -f

# Stop and remove any leftover containers with similar names
echo -e "${YELLOW}Removing any leftover containers...${NC}"
docker ps -a | grep -E "social.*genius|pgadmin|postgres" | awk '{print $1}' | xargs -r docker rm -f

# Check for port conflicts and kill processes using our ports
echo -e "${YELLOW}Checking for port conflicts...${NC}"
for PORT in 3001 5050 5432; do
  # Try different methods to find processes using the ports
  echo -e "${YELLOW}Checking port $PORT...${NC}"
  
  # Method 1: Using lsof
  CONFLICTING_PIDS=$(lsof -i:$PORT -t 2>/dev/null)
  if [ -n "$CONFLICTING_PIDS" ]; then
    echo -e "${YELLOW}Found processes using port $PORT. Killing processes...${NC}"
    for PID in $CONFLICTING_PIDS; do
      echo -e "${YELLOW}Killing process $PID...${NC}"
      kill -9 $PID 2>/dev/null
    done
  fi
  
  # Method 2: Using netstat for Linux
  if command -v netstat &> /dev/null; then
    NETSTAT_PIDS=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1)
    if [ -n "$NETSTAT_PIDS" ]; then
      echo -e "${YELLOW}Found additional processes using port $PORT via netstat. Killing processes...${NC}"
      for PID in $NETSTAT_PIDS; do
        if [ -n "$PID" ] && [ "$PID" != "-" ]; then
          echo -e "${YELLOW}Killing process $PID...${NC}"
          kill -9 $PID 2>/dev/null
        fi
      done
    fi
  fi
  
  # Method 3: Try to release the port by stopping Docker containers that might use it
  echo -e "${YELLOW}Attempting to stop any Docker containers using port $PORT...${NC}"
  docker ps -q --filter "publish=$PORT" | xargs -r docker stop
  
  # Wait a moment for the port to be fully released
  sleep 2
done

# Apply database connection fixes
echo -e "${YELLOW}Applying database connection fixes...${NC}"
# Copy fixed postgres service to the active service
cp -f services/postgres-service-fixed.ts services/postgres-service.ts
echo -e "${GREEN}Database service fixed applied.${NC}"

# Clean up any previous builds
echo -e "${YELLOW}Cleaning up previous builds...${NC}"
rm -rf dist/ node_modules/.cache

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${GREEN}.env file created from example. Please update it with your API keys.${NC}"
  else
    echo -e "${RED}No .env.example file found. Please create a .env file manually.${NC}"
    exit 1
  fi
fi

# Rebuild the images
echo -e "${YELLOW}Rebuilding all containers with no cache...${NC}"
docker-compose -f docker-compose.dev.yml build --no-cache

# Start the containers with proper error handling
echo -e "${YELLOW}Starting rebuilt containers...${NC}"
if ! docker-compose -f docker-compose.dev.yml up -d --force-recreate; then
  echo -e "${RED}Failed to start containers even with forced recreation.${NC}"
  echo -e "${YELLOW}Attempting emergency cleanup and restart...${NC}"
  
  # Emergency cleanup but preserve database volumes for persistence
  docker-compose -f docker-compose.dev.yml down --remove-orphans # Removed -v flag to preserve volumes
  # Only prune containers and networks, not volumes
  docker container prune -f
  docker network prune -f
  
  # Final attempt
  if ! docker-compose -f docker-compose.dev.yml up -d; then
    echo -e "${RED}All attempts to start containers failed. Trying with fixed configuration...${NC}"
    # Try with fixed configuration
    if ! docker-compose -f docker-compose-fixed.yml up -d; then
      echo -e "${RED}All attempts to start containers failed. See errors above.${NC}"
      exit 1
    fi
  fi
fi

# Check if containers are running
RUNNING_CONTAINERS=$(docker-compose -f docker-compose.dev.yml ps --services --filter "status=running" | wc -l)
if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
  echo -e "${GREEN}Development containers rebuilt and started successfully!${NC}"
  
  # Print the actual ports being used
  APP_PORT=$(docker-compose -f docker-compose.dev.yml port app 3000 | cut -d':' -f2 || echo "3001")
  PGADMIN_PORT=$(docker-compose -f docker-compose.dev.yml port pgadmin 80 | cut -d':' -f2 || echo "5050")
  
  echo -e "${GREEN}Web app: http://localhost:${APP_PORT}${NC}"
  echo -e "${GREEN}pgAdmin: http://localhost:${PGADMIN_PORT} (login with admin@socialgenius.com / admin)${NC}"
  
  # Check database connectivity
  echo -e "${YELLOW}Testing database connectivity...${NC}"
  # Wait for application to connect to database
  sleep 20
  
  # Check if the tables are created successfully
  echo -e "${YELLOW}Checking if database tables are initialized...${NC}"
  docker exec ${PROJECT_NAME}_app_1 node -e "
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@172.18.0.2:5432/socialgenius',
    max: 5,
    connectionTimeoutMillis: 5000
  });
  
  pool.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = \'users\')')
    .then(res => {
      console.log(res.rows[0].exists ? 'Database tables exist' : 'Database tables need to be created');
      if (!res.rows[0].exists) {
        console.log('Initializing database tables...');
        pool.query('CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY)')
          .then(() => console.log('Tables created successfully'))
          .catch(err => console.error('Error creating tables:', err))
          .finally(() => pool.end());
      } else {
        pool.end();
      }
    })
    .catch(err => {
      console.error('Error checking database:', err);
      pool.end();
    });
  " || echo -e "${RED}Failed to check database connectivity${NC}"
  
  # Always show logs
  echo -e "${YELLOW}Showing logs...${NC}"
  docker-compose -f docker-compose.dev.yml logs -f app
else
  echo -e "${RED}Containers may have started but aren't running. Check docker ps for status.${NC}"
  docker ps -a
  exit 1
fi