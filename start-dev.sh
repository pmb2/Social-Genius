#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# Project name for container naming
PROJECT_NAME="social-genius"

echo -e "${YELLOW}Starting Social Genius in development mode...${NC}"

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

# Check for existing containers with the project name and automatically stop them
FOUND_CONTAINERS=$(docker ps -a --filter name=${PROJECT_NAME} --format "{{.Names}}")

if [ -n "$FOUND_CONTAINERS" ]; then
  echo -e "${YELLOW}Found existing Social Genius containers:${NC}"
  echo "$FOUND_CONTAINERS"
  echo -e "${YELLOW}Automatically stopping existing containers...${NC}"
  docker-compose -f docker-compose.dev.yml down
  echo -e "${GREEN}Existing containers stopped.${NC}"
fi

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

# Force remove any Docker containers using our ports
echo -e "${YELLOW}Force removing any Docker containers using our ports...${NC}"
for PORT in 3001 5050 5432 5435; do
  CONTAINER_IDS=$(docker ps -q --filter "publish=$PORT")
  if [ -n "$CONTAINER_IDS" ]; then
    echo -e "${YELLOW}Removing containers using port $PORT...${NC}"
    docker rm -f $CONTAINER_IDS 2>/dev/null || true
  fi
done

# Remove any stale networks
echo -e "${YELLOW}Removing any stale Docker networks...${NC}"
docker network prune -f

# Stop and remove any leftover containers with similar names
echo -e "${YELLOW}Removing any leftover containers...${NC}"
docker ps -a | grep -E "social.*genius|pgadmin|postgres" | awk '{print $1}' | xargs -r docker rm -f

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

# Start the containers with proper error handling
echo -e "${YELLOW}Starting development containers...${NC}"
# First, try with regular docker-compose up
if ! docker-compose -f docker-compose.dev.yml up -d; then
  echo -e "${YELLOW}First attempt failed, trying with forced recreation...${NC}"
  # If that fails, try force recreating
  if ! docker-compose -f docker-compose.dev.yml up -d --force-recreate; then
    echo -e "${RED}Failed to start containers even with forced recreation.${NC}"
    echo -e "${YELLOW}Attempting emergency cleanup and restart...${NC}"
    
    # Emergency cleanup
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans
    docker system prune -f
    
    # Final attempt
    if ! docker-compose -f docker-compose.dev.yml up -d; then
      echo -e "${RED}All attempts to start containers failed. See errors above.${NC}"
      exit 1
    fi
  fi
fi

# Check if containers are running
RUNNING_CONTAINERS=$(docker-compose -f docker-compose.dev.yml ps --services --filter "status=running" | wc -l)
if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
  echo -e "${GREEN}Development containers started successfully!${NC}"
  
  # Print the actual ports being used
  APP_PORT=$(docker-compose -f docker-compose.dev.yml port app 3000 | cut -d':' -f2 || echo "3001")
  PGADMIN_PORT=$(docker-compose -f docker-compose.dev.yml port pgadmin 80 | cut -d':' -f2 || echo "5050")
  
  echo -e "${GREEN}Web app: http://localhost:${APP_PORT}${NC}"
  echo -e "${GREEN}pgAdmin: http://localhost:${PGADMIN_PORT} (login with admin@socialgenius.com / admin)${NC}"
  
  # Always show logs with filtering to reduce noise
  echo -e "${YELLOW}Showing filtered logs (removing Next.js noise while preserving business logs)...${NC}"
  
  # Set environment variables for the Docker logs command
  export SUPPRESS_FAST_REFRESH_LOGS=true
  export DEBUG_SESSION=false
  export DEBUG_MIDDLEWARE=false
  export NODE_NO_WARNINGS=1
  export NO_COLOR=1
  export NEXT_WEBPACK_LOGGING=error
  export NEXT_SUPPRESS_LOGS=1
  
  # Keep business-critical logs while filtering out Next.js noise, but ensure the stream doesn't die
  # Filter out build asset logs, compilation messages, and other Next.js noise
  # The trick is to use a single grep with alternation instead of multiple pipes
  docker-compose -f docker-compose.dev.yml logs -f app | grep -v -E '(Compiled in|compiled|✓ Compiled|modules\)$|webpack|event compiled client|assets by|asset |% \(0 affected|% modules flagged|% of exports|% root snapshot|queue items processed|chunk groups|new snapshots created|File info in cache|Directory info in cache|Managed items|\+ [0-9]+ hidden lines|modules hashed|0% children snapshot|entries tested|entries updated|\s+$|LOG from webpack|\[compared for emit\]|\[emitted\]|\[cached\]|compiled successfully|Ready in [0-9]+ms|bytes|Entrypoint|orphan modules|runtime modules|modules by path|\+ [0-9]+ modules|\+ [0-9]+ assets|Replaced "process\.env|cacheable modules|[0-9]+% \([0-9]+ affected|javascript modules|css modules|File timestamp snapshot|Directory timestamp snapshot|Missing items snapshot|code generated [\(0-9]|really resolved|Warning:|Component Stack:|Source map error|Stack|Resource URL|The resource at|Unable to check|Failed to load|\<anonymous code\>|[0-9]+\s+[a-zA-Z0-9$_@]|snapshot|[0-9]+% children|Managed files)'
  
  # If the above command exits for any reason, make sure we're still showing logs
  echo -e "${YELLOW}Log stream interrupted. Restarting log view...${NC}"
  docker-compose -f docker-compose.dev.yml logs -f
else
  echo -e "${RED}Containers may have started but aren't running. Check docker ps for status.${NC}"
  docker ps -a
  exit 1
fi