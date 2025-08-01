#!/usr/bin/env bash

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
docker-compose -f docker-compose.dev.yml down --remove-orphans

# Ensure named volumes exist (Docker will reuse if they already exist)
docker volume create ${PROJECT_NAME}_postgres_data 2>/dev/null || true
docker volume create ${PROJECT_NAME}_redis_data 2>/dev/null || true

# Explicitly remove named volumes to ensure a clean state
# echo -e "${YELLOW}Removing Docker volumes to ensure a clean database state...${NC}"
# # docker volume rm -f ${PROJECT_NAME}_postgres_data ${PROJECT_NAME}_redis_data 2>/dev/null || true

# Remove any stale networks
echo -e "${YELLOW}Removing any stale Docker networks...${NC}"
docker network prune -f

# Stop and remove any leftover containers with similar names
echo -e "${YELLOW}Removing any leftover containers...${NC}"
docker ps -a | grep -E "social.*genius|pgadmin|postgres" | awk '{print $1}' | xargs -r docker rm -f

# Check for port conflicts and handle them intelligently
echo -e "${YELLOW}Checking for port conflicts...${NC}"

# Function to extract ports from docker-compose files using yq
extract_ports_from_compose() {
  local compose_file=$1
  local service_name=$2
  if command -v yq &>/dev/null; then
    yq ".services.${service_name}.ports[] | select(. != null) | .split(\":\")[0]" "$compose_file" 2>/dev/null
  fi
}

# Dynamically detect ports from docker-compose files
declare -A SERVICE_PORTS=()
declare -A PORT_TO_SERVICE=()

# Check multiple docker-compose files
for compose_file in "docker-compose.dev.yml" "docker-compose.yml" "docker-compose-fixed.yml"; do
  if [ -f "$compose_file" ]; then
    echo -e "${YELLOW}Extracting ports from $compose_file...${NC}"
    if command -v yq &>/dev/null; then
      # Get all service names
      services=$(yq ".services | keys | .[]" "$compose_file" 2>/dev/null)
      for service in $services; do
        # Get all ports for the current service
        ports=$(extract_ports_from_compose "$compose_file" "$service")
        for host_port in $ports; do
          if [ -n "$host_port" ]; then
            SERVICE_PORTS["$service"]="$host_port"
            PORT_TO_SERVICE["$host_port"]="$service"
            echo -e "${GREEN}Found port mapping: $service -> $host_port${NC}"
            # Assuming one host port per service for simplicity in this script's logic
            break
          fi
        done
      done
    else
      echo -e "${RED}yq is not installed. Please install yq to enable robust port detection.${NC}"
      echo -e "${YELLOW}Falling back to default ports.${NC}"
      break # Exit loop if yq is not available
    fi
    break  # Use the first available compose file that has services
  fi
done


# Fallback ports if none detected
if [ ${#SERVICE_PORTS[@]} -eq 0 ]; then
  echo -e "${YELLOW}No ports detected from compose files, using defaults...${NC}"
  SERVICE_PORTS=(
    ["app"]="3000"
    ["pgadmin"]="5050"
    ["postgres"]="5435"
    ["redis"]="6380"
    ["browser-use-api"]="5055"
    ["redis-commander"]="8081"
  )
fi

# Additionally scan for any currently running Docker containers that might conflict
echo -e "${YELLOW}Scanning for running Docker containers with port conflicts...${NC}"
running_containers=$(docker ps --format "table {{.Names}}\t{{.Ports}}" 2>/dev/null | tail -n +2)
if [ -n "$running_containers" ]; then
  while IFS= read -r container_line; do
    if [[ $container_line =~ 0\.0\.0\.0:([0-9]+)- ]]; then
      used_port="${BASH_REMATCH[1]}"
      container_name=$(echo "$container_line" | awk '{print $1}')
      
      # Check if this port conflicts with our services
      for service in "${!SERVICE_PORTS[@]}"; do
        if [ "${SERVICE_PORTS[$service]}" = "$used_port" ]; then
          echo -e "${RED}Port conflict detected: $container_name is using port $used_port (needed for $service)${NC}"
          
          # Try to stop the conflicting container if it's not one of our services
          if [[ ! $container_name =~ social.*genius ]]; then
            echo -e "${YELLOW}Attempting to stop conflicting container: $container_name${NC}"
            docker stop "$container_name" 2>/dev/null || true
          fi
        fi
      done
    fi
  done <<< "$running_containers"
fi

declare -A FINAL_PORTS=()

# Function to check if a port is available (enhanced with multiple methods)
check_port_available() {
  local port=$1
  
  # Method 1: Check with lsof
  if command -v lsof &>/dev/null && lsof -i:"$port" -t &>/dev/null; then
    echo "Port $port is in use (detected by lsof)"
    return 1
  fi
  
  # Method 2: Check with netstat
  if command -v netstat &>/dev/null && netstat -tuln 2>/dev/null | grep -q ":$port "; then
    echo "Port $port is in use (detected by netstat)"
    return 1
  fi
  
  # Method 3: Check with ss (more modern alternative to netstat)
  if command -v ss &>/dev/null && ss -tuln 2>/dev/null | grep -q ":$port "; then
    echo "Port $port is in use (detected by ss)"
    return 1
  fi
  
  # Method 4: Try to bind to the port temporarily
  if command -v nc &>/dev/null; then
    if ! nc -z localhost "$port" 2>/dev/null; then
      # Port appears to be free, but let's double-check by trying to listen
      if timeout 1 nc -l "$port" 2>/dev/null &
      then
        local nc_pid=$!
        sleep 0.1
        kill $nc_pid 2>/dev/null
        wait $nc_pid 2>/dev/null
        return 0  # Port is available
      else
        echo "Port $port failed bind test"
        return 1  # Port is in use
      fi
    else
      echo "Port $port is in use (detected by nc)"
      return 1
    fi
  fi
  
  # Method 5: Check Docker containers specifically
  if docker ps --format "table {{.Names}}\t{{.Ports}}" 2>/dev/null | grep -q ":$port->"; then
    echo "Port $port is in use by Docker container"
    return 1
  fi
  
  return 0  # Port appears to be available
}

# Function to find next available port (enhanced)
find_available_port() {
  local base_port=$1
  local current_port=$base_port
  local max_attempts=200
  local attempt=0
  
  while [ $attempt -lt $max_attempts ]; do
    if check_port_available $current_port >/dev/null 2>&1; then
      # Double-check by trying to bind briefly
      if command -v nc &>/dev/null; then
        if timeout 1 nc -l "$current_port" 2>/dev/null &
        then
          local nc_pid=$!
          sleep 0.1
          kill $nc_pid 2>/dev/null
          wait $nc_pid 2>/dev/null
          echo $current_port
          return 0
        fi
      else
        echo $current_port
        return 0
      fi
    fi
    
    current_port=$((current_port + 1))
    attempt=$((attempt + 1))
    
    # Skip common system ports
    if [ $current_port -eq 22 ] || [ $current_port -eq 80 ] || [ $current_port -eq 443 ] || [ $current_port -eq 3306 ] || [ $current_port -eq 5432 ]; then
      current_port=$((current_port + 1))
    fi
  done
  
  echo -e "${RED}Could not find a free port after $max_attempts attempts starting from $base_port.${NC}" >&2
  exit 1
}

# Check each service port with enhanced detection
for service in "${!SERVICE_PORTS[@]}"; do
  original_port=${SERVICE_PORTS[$service]}
  echo -e "${YELLOW}Checking port $original_port for $service...${NC}"
  
  # Kill any processes using the port first
  echo -e "${YELLOW}Ensuring port $original_port is completely free...${NC}"
  
  # Find and kill processes using the port
  if command -v lsof &>/dev/null; then
    PIDS=$(lsof -ti:"$original_port" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
      echo -e "${YELLOW}Found processes using port $original_port: $PIDS${NC}"
      echo "$PIDS" | xargs -r kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
  
  # Stop any Docker containers using this port
  DOCKER_CONTAINERS=$(docker ps --filter "publish=$original_port" -q 2>/dev/null || true)
  if [ -n "$DOCKER_CONTAINERS" ]; then
    echo -e "${YELLOW}Stopping Docker containers using port $original_port...${NC}"
    echo "$DOCKER_CONTAINERS" | xargs -r docker stop 2>/dev/null || true
    sleep 2
  fi
  
  # Double-check the port is now available
  if check_port_available $original_port; then
    echo -e "${GREEN}Port $original_port is free for $service.${NC}"
    FINAL_PORTS[$service]=$original_port
  else
    # Find an alternative port
    echo -e "${YELLOW}Port $original_port is still in use. Finding alternative port for $service...${NC}"
    alt_port=$(find_available_port $((original_port + 1)))
    echo -e "${GREEN}Found alternative port: $alt_port for $service${NC}"
    FINAL_PORTS[$service]=$alt_port
  fi
done

# Inform user of the ports we're using
echo -e "${GREEN}Using ports:${NC}"
for service in "${!FINAL_PORTS[@]}"; do
  echo -e "${GREEN}  $service: ${FINAL_PORTS[$service]}${NC}"
done

# Check if we need to create an override file for custom ports
NEEDS_OVERRIDE=false
for service in "${!FINAL_PORTS[@]}"; do
  original_port=${SERVICE_PORTS[$service]}
  final_port=${FINAL_PORTS[$service]}
  if [ "$original_port" != "$final_port" ]; then
    NEEDS_OVERRIDE=true
    break
  fi
done

if [ "$NEEDS_OVERRIDE" = true ]; then
  echo -e "${YELLOW}Creating temporary docker-compose override for custom ports...${NC}"
  
  cat > docker-compose.override.yml << EOF
services:
EOF

  # Add port overrides for services that need them dynamically
  for service in "${!FINAL_PORTS[@]}"; do
    original_port=${SERVICE_PORTS[$service]}
    final_port=${FINAL_PORTS[$service]}
    
    if [ "$original_port" != "$final_port" ]; then
      # Determine internal port based on service type or use a mapping
      internal_port=""
      case $service in
        "app") internal_port="3000" ;;
        "pgadmin") internal_port="5050" ;;
        "postgres") internal_port="5432" ;;
        "redis") internal_port="6379" ;;
        "browser-use-api") internal_port="5055" ;;
        "redis-commander") internal_port="8081" ;;
        *)
          # For unknown services, assume internal port equals original external port
          internal_port="$original_port"
          ;;
      esac
      
      cat >> docker-compose.override.yml << EOF
  $service:
    ports:
      - "${final_port}:${internal_port}"
EOF
    fi
  done
  
  echo -e "${GREEN}Created docker-compose override file with custom ports.${NC}"
else
  # If no custom ports, ensure override file doesn't exist to avoid conflicts
  rm -f docker-compose.override.yml
  echo -e "${GREEN}All ports are available, no override needed.${NC}"
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
rm -rf dist/ .next node_modules/.cache

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
echo -e "${YELLOW}Clearing Docker build cache...${NC}"
docker builder prune -f

echo -e "${YELLOW}Rebuilding all containers with no cache...${NC}"
if [ -f docker-compose.override.yml ]; then
  echo -e "${YELLOW}Using custom port configuration for build...${NC}"
  docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml build --no-cache
else
  docker-compose -f docker-compose.dev.yml build --no-cache
fi

# Start the containers with enhanced error handling and retry logic
echo -e "${YELLOW}Starting rebuilt containers...${NC}"

# Function to attempt container startup with retries
start_containers_with_retry() {
  local max_retries=3
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    echo -e "${YELLOW}Attempt $((retry + 1)) of $max_retries to start containers...${NC}"
    
    # Define the start command based on whether we have an override file
    if [ -f docker-compose.override.yml ]; then
      echo -e "${YELLOW}Using custom port configuration...${NC}"
      START_CMD="docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d --force-recreate"
    else
      START_CMD="docker-compose -f docker-compose.dev.yml up -d --force-recreate"
    fi
    
    if eval $START_CMD; then
      echo -e "${GREEN}Containers started successfully!${NC}"
      return 0
    else
      echo -e "${RED}Failed to start containers on attempt $((retry + 1))).${NC}"
      
      # If this failed due to port conflicts, try to resolve them
      if docker-compose logs 2>&1 | grep -q "port is already allocated"; then
        echo -e "${YELLOW}Detected port allocation conflict. Attempting to resolve...${NC}"
        
        # Find which ports are actually conflicting and reassign them
        for service in "${!FINAL_PORTS[@]}"; do
          port=${FINAL_PORTS[$service]}
          if ! check_port_available $port >/dev/null 2>&1; then
            echo -e "${YELLOW}Port $port for $service is now in use, finding new port...${NC}"
            new_port=$(find_available_port $((port + 1)))
            FINAL_PORTS[$service]=$new_port
            echo -e "${GREEN}Reassigned $service to port $new_port${NC}"
          fi
        done
        
        # Recreate override file with new ports
        if [ "$NEEDS_OVERRIDE" = true ] || [ -f docker-compose.override.yml ]; then
          echo -e "${YELLOW}Updating docker-compose override with new ports...${NC}"
          
          cat > docker-compose.override.yml << EOF
services:
EOF

          # Add port overrides for all services dynamically
          for service in "${!FINAL_PORTS[@]}"; do
            original_port=${SERVICE_PORTS[$service]}
            final_port=${FINAL_PORTS[$service]}
            
            if [ "$original_port" != "$final_port" ]; then
              # Determine internal port based on service type or use a mapping
              internal_port=""
              case $service in
                "app") internal_port="3000" ;;
                "pgadmin") internal_port="5050" ;;
                "postgres") internal_port="5432" ;;
                "redis") internal_port="6379" ;;
                "browser-use-api") internal_port="5055" ;;
                "redis-commander") internal_port="8081" ;;
                *)
                  # For unknown services, assume internal port equals original external port
                  internal_port="$original_port"
                  ;;
              esac
              
              cat >> docker-compose.override.yml << EOF
  $service:
    ports:
      - "${final_port}:${internal_port}"
EOF
            fi
          done
        fi
      fi
      
      # Clean up before retry
      echo -e "${YELLOW}Cleaning up before retry...${NC}"
      if [ -f docker-compose.override.yml ]; then
        docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml down --remove-orphans 2>/dev/null || true
      else
        docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
      fi
      
      # Wait a bit before retry
      sleep 3
      retry=$((retry + 1))
    fi
  done
  
  return 1
}

# Try to start containers with retry logic
if ! start_containers_with_retry; then
  echo -e "${RED}All attempts to start containers failed after retries.${NC}"
  echo -e "${YELLOW}Attempting final emergency cleanup and fallback...${NC}"
  
  # Emergency cleanup
  docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
  docker container prune -f 2>/dev/null || true
  docker network prune -f 2>/dev/null || true
  
  # Try with fixed configuration as last resort
  if [ -f docker-compose-fixed.yml ]; then
    echo -e "${YELLOW}Trying with fixed configuration as last resort...${NC}"
    if ! docker-compose -f docker-compose-fixed.yml up -d; then
      echo -e "${RED}All attempts to start containers failed. Please check the logs above for specific errors.${NC}"
      exit 1
    fi
  else
    echo -e "${RED}No fixed configuration available. All attempts failed.${NC}"
    exit 1
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
  echo -e "${GREEN}Services are running on the following ports:${NC}"
  echo -e "${GREEN}  Web app: http://localhost:${FINAL_PORTS[app]}${NC}"
  echo -e "${GREEN}  pgAdmin: http://localhost:${FINAL_PORTS[pgadmin]} (login with admin@socialgenius.com / admin)${NC}"
  echo -e "${GREEN}  Redis Commander: http://localhost:${FINAL_PORTS[redis-commander]}${NC}"
  echo -e "${GREEN}  Browser API: http://localhost:${FINAL_PORTS[browser-use-api]}${NC}"
  echo -e "${GREEN}  Redis: localhost:${FINAL_PORTS[redis]}${NC}"
  echo -e "${GREEN}  PostgreSQL: localhost:${FINAL_PORTS[postgres]}${NC}"
  
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
fi