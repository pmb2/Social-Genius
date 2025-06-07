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

# Check for port conflicts and handle them intelligently
echo -e "${YELLOW}Checking for port conflicts...${NC}"
ORIGINAL_PORTS=(3001 5050 5432)
FINAL_PORTS=()

for i in "${!ORIGINAL_PORTS[@]}"; do
  PORT=${ORIGINAL_PORTS[$i]}
  echo -e "${YELLOW}Checking port $PORT...${NC}"
  
  # Check if port is in use
  if lsof -i:"$PORT" -t &>/dev/null || (command -v netstat &>/dev/null && netstat -tuln 2>/dev/null | grep -q ":$PORT "); then
    # Check if it's our own docker container using the port
    OUR_CONTAINER=$(docker ps --filter "name=${PROJECT_NAME}" --filter "publish=$PORT" -q)
    
    if [ -n "$OUR_CONTAINER" ]; then
      echo -e "${YELLOW}Port $PORT is used by our own container. Stopping it...${NC}"
      docker stop "$OUR_CONTAINER"
      FINAL_PORTS+=($PORT)
    else
      # If it's not our container, find an alternative port
      echo -e "${YELLOW}Port $PORT is used by another application. Finding alternative port...${NC}"
      
      # Start with base port number and increment until we find a free port
      ALT_PORT=$((PORT + 1))
      while lsof -i:"$ALT_PORT" -t &>/dev/null || (command -v netstat &>/dev/null && netstat -tuln 2>/dev/null | grep -q ":$ALT_PORT "); do
        ALT_PORT=$((ALT_PORT + 1))
        if [ $ALT_PORT -gt $((PORT + 100)) ]; then
          # Give up after trying 100 ports to avoid infinite loop
          echo -e "${RED}Could not find a free port in range $(PORT)-$((PORT + 100)). Please free up some ports.${NC}"
          exit 1
        fi
      done
      
      echo -e "${GREEN}Found alternative port: $ALT_PORT${NC}"
      FINAL_PORTS+=($ALT_PORT)
      
      # We'll update the docker-compose file with this port later
      if [ $PORT -eq 3001 ]; then
        APP_PORT=$ALT_PORT
      elif [ $PORT -eq 5050 ]; then
        PGADMIN_PORT=$ALT_PORT
      elif [ $PORT -eq 5432 ]; then
        DB_PORT=$ALT_PORT
      fi
    fi
  else
    # Port is free, use as is
    echo -e "${GREEN}Port $PORT is free.${NC}"
    FINAL_PORTS+=($PORT)
  fi
done

# Inform user of the ports we're using
echo -e "${GREEN}Using ports: app=${FINAL_PORTS[0]}, pgadmin=${FINAL_PORTS[1]}, postgres=${FINAL_PORTS[2]}${NC}"

# Create a temporary docker-compose override file if needed
if [ -n "$APP_PORT" ] || [ -n "$PGADMIN_PORT" ] || [ -n "$DB_PORT" ]; then
  echo -e "${YELLOW}Creating temporary docker-compose override for custom ports...${NC}"
  
  cat > docker-compose.override.yml << EOF
version: '3.8'
services:
EOF

  if [ -n "$APP_PORT" ]; then
    cat >> docker-compose.override.yml << EOF
  app:
    ports:
      - "${APP_PORT}:3000"
EOF
  fi
  
  if [ -n "$PGADMIN_PORT" ]; then
    cat >> docker-compose.override.yml << EOF
  pgadmin:
    ports:
      - "${PGADMIN_PORT}:5050"
EOF
  fi
  
  if [ -n "$DB_PORT" ]; then
    cat >> docker-compose.override.yml << EOF
  postgres:
    ports:
      - "${DB_PORT}:5432"
EOF
  fi
  
  echo -e "${GREEN}Created docker-compose override file with custom ports.${NC}"
else
  # If no custom ports, ensure override file doesn't exist to avoid conflicts
  rm -f docker-compose.override.yml
fi

# Apply database connection fixes
echo -e "${YELLOW}Applying database connection fixes...${NC}"
# Copy fixed postgres service to the active service
if [ -f services/postgres-service-fixed.ts ]; then
  cp -f services/postgres-service-fixed.ts services/postgres-service.ts
  echo -e "${GREEN}Database service fixed applied.${NC}"
else
  echo -e "${YELLOW}Database service fix file not found, skipping...${NC}"
fi

# Ensure custom server file is present
if [ ! -f server.cjs ]; then
  echo -e "${YELLOW}Creating Express server file...${NC}"
  cat > server.cjs << 'EOL'
// Express server for Next.js (CommonJS version)
const express = require('express');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
// Always bind to 0.0.0.0 to ensure the app is accessible externally
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server with binding to ${hostname}:${port}, NODE_ENV=${process.env.NODE_ENV}`);
console.log(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL}, GOOGLE_REDIRECT_URI=${process.env.GOOGLE_REDIRECT_URI}`);

// Initialize Next.js
const app = next({ dev, dir: '.' });
const handle = app.getRequestHandler();

// Prepare the Next.js application
app.prepare()
  .then(() => {
    const server = express();
    
    // Log all requests for debugging
    server.use((req, res, next) => {
      if (req.path !== '/health' && req.path !== '/api/health') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      }
      next();
    });
    
    // Health check endpoint
    server.get('/health', (req, res) => {
      res.status(200).send('OK');
    });
    
    server.get('/api/health', (req, res) => {
      res.status(200).send('OK');
    });
    
    // Handle all other requests with Next.js
    server.all('*', (req, res) => {
      return handle(req, res);
    });
    
    // Create HTTP server
    const httpServer = createServer(server);
    
    // Explicitly listen on all interfaces
    httpServer.listen(port, hostname, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Access via http://localhost:${port} or http://app.social-genius.com`);
      console.log(`> Environment: ${process.env.NODE_ENV}`);
      console.log(`> Auth URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
      console.log(`> Google Redirect: ${process.env.GOOGLE_REDIRECT_URI || 'not set'}`);
    });
  })
  .catch((ex) => {
    console.error('An error occurred starting the server:');
    console.error(ex.stack);
    process.exit(1);
  });
EOL
  echo -e "${GREEN}Express server file created successfully${NC}"
fi

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
if [ -f docker-compose.override.yml ]; then
  echo -e "${YELLOW}Using custom port configuration for build...${NC}"
  docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml build --no-cache
else
  docker-compose -f docker-compose.dev.yml build --no-cache
fi

# Start the containers with proper error handling
echo -e "${YELLOW}Starting rebuilt containers...${NC}"

# Define the start command based on whether we have an override file
if [ -f docker-compose.override.yml ]; then
  echo -e "${YELLOW}Using custom port configuration...${NC}"
  START_CMD="docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d --force-recreate"
else
  START_CMD="docker-compose -f docker-compose.dev.yml up -d --force-recreate"
fi

if ! eval $START_CMD; then
  echo -e "${RED}Failed to start containers even with forced recreation.${NC}"
  echo -e "${YELLOW}Attempting emergency cleanup and restart...${NC}"
  
  # Emergency cleanup but preserve database volumes for persistence
  if [ -f docker-compose.override.yml ]; then
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml down --remove-orphans
  else
    docker-compose -f docker-compose.dev.yml down --remove-orphans
  fi
  
  # Only prune containers and networks, not volumes
  docker container prune -f
  docker network prune -f
  
  # Final attempt with original ports
  if ! eval $START_CMD; then
    echo -e "${RED}All attempts to start containers failed. Trying with fixed configuration...${NC}"
    # Try with fixed configuration
    if [ -f docker-compose-fixed.yml ]; then
      if ! docker-compose -f docker-compose-fixed.yml up -d; then
        echo -e "${RED}All attempts to start containers failed. See errors above.${NC}"
        exit 1
      fi
    else
      echo -e "${RED}No fixed configuration available. All attempts to start containers failed.${NC}"
      exit 1
    fi
  fi
fi

# Check if containers are running
if [ -f docker-compose.override.yml ]; then
  RUNNING_CONTAINERS=$(docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml ps --services --filter "status=running" | wc -l)
else
  RUNNING_CONTAINERS=$(docker-compose -f docker-compose.dev.yml ps --services --filter "status=running" | wc -l)
fi

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
  echo -e "${GREEN}Development containers rebuilt and started successfully!${NC}"
  
  # Print the actual ports being used
  if [ -f docker-compose.override.yml ]; then
    APP_PORT=$(docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml port app 3000 | cut -d':' -f2 || echo "${FINAL_PORTS[0]}")
    PGADMIN_PORT=$(docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml port pgadmin 80 | cut -d':' -f2 || echo "${FINAL_PORTS[1]}")
  else
    APP_PORT=$(docker-compose -f docker-compose.dev.yml port app 3000 | cut -d':' -f2 || echo "3001")
    PGADMIN_PORT=$(docker-compose -f docker-compose.dev.yml port pgadmin 80 | cut -d':' -f2 || echo "5050")
  fi
  
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
  if [ -f docker-compose.override.yml ]; then
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml logs -f app
  else
    docker-compose -f docker-compose.dev.yml logs -f app
  fi
else
  echo -e "${RED}Containers may have started but aren't running. Check docker ps for status.${NC}"
  docker ps -a
  exit 1
fi