#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Social Genius with sudo in development mode...${NC}"
echo -e "${YELLOW}This script runs Docker commands with sudo to bypass permission issues.${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
  exit 1
fi

# Ensure Docker service is running
echo -e "${YELLOW}Ensuring Docker service is running...${NC}"
sudo systemctl start docker || true

# Check for existing containers
echo -e "${YELLOW}Checking for existing Social Genius containers...${NC}"
CONTAINERS=$(sudo docker ps -a --filter name=social-genius --format "{{.Names}}" 2>/dev/null || echo "")

if [ ! -z "$CONTAINERS" ]; then
  echo -e "${YELLOW}Found existing containers, automatically stopping them...${NC}"
  echo "$CONTAINERS"
  
  echo -e "${YELLOW}Stopping existing containers...${NC}"
  sudo docker-compose -f docker-compose.dev.yml down
  echo -e "${GREEN}Existing containers stopped.${NC}"
fi

# Check for .env file
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

# Make sure the .env file has both DATABASE_URL and DATABASE_URL_DOCKER
if [ -f .env ]; then
  # Check if DATABASE_URL_DOCKER is in the file
  if ! grep -q "DATABASE_URL_DOCKER" .env; then
    echo -e "${YELLOW}Adding DATABASE_URL_DOCKER to .env file...${NC}"
    echo "# For Docker setup (when app is running inside Docker container)" >> .env
    echo "DATABASE_URL_DOCKER=postgresql://postgres:postgres@postgres:5432/socialgenius" >> .env
  fi
fi

# Load environment variables and pass them to docker-compose
echo -e "${YELLOW}Loading environment variables from .env file...${NC}"
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Function to kill process using a specific port - uses the most direct approach
kill_process_on_port() {
  local port=$1
  echo -e "${YELLOW}Attempting to kill any process using port $port directly...${NC}"
  
  # Skip the process detection and just kill anything on that port using fuser
  echo -e "${YELLOW}Using fuser to force kill anything on port $port...${NC}"
  sudo fuser -k -n tcp $port 2>/dev/null
  sleep 2
  
  # Verify the port is now free
  if sudo netstat -tuln | grep -q ":$port "; then
    echo -e "${RED}Port $port is still in use after attempt to free it.${NC}"
    
    # Try more forceful methods
    echo -e "${YELLOW}Trying more forceful approach to free port $port...${NC}"
    
    # Try to forcefully kill leftover docker containers
    echo -e "${YELLOW}Forcefully removing any docker containers...${NC}"
    sudo docker ps -a -q | xargs -r sudo docker rm -f 2>/dev/null
    
    # Try iptables to release the port
    echo -e "${YELLOW}Attempting to release the port via iptables...${NC}"
    sudo iptables -t nat -F
    
    # Try to restart the docker service
    echo -e "${YELLOW}Restarting Docker service...${NC}"
    sudo systemctl restart docker
    sleep 3
    
    # Last attempt with fuser
    echo -e "${YELLOW}Final attempt to free port $port...${NC}"
    sudo fuser -k -n tcp $port 2>/dev/null
    
    return 1
  else
    echo -e "${GREEN}Port $port is now free.${NC}"
    return 0
  fi
}

# Ensure favicon is correctly set up
echo -e "${YELLOW}Ensuring favicon is correctly set up...${NC}"
cp -f public/favicon.ico app/ 2>/dev/null || echo -e "${YELLOW}Favicon copy failed - not critical${NC}"

# Install dotenv and pg if needed
if ! npm list dotenv pg &>/dev/null; then
  echo -e "${YELLOW}Installing required dependencies...${NC}"
  npm install dotenv pg --no-save || echo -e "${YELLOW}Optional dependency installation failed - will continue${NC}"
fi

# Start containers with sudo
echo -e "${YELLOW}Starting Social Genius development containers with sudo...${NC}"

# More aggressive cleanup before starting - this is the key change
echo -e "${YELLOW}Performing thorough cleanup before starting containers...${NC}"

# Stop and remove ALL docker containers
echo -e "${YELLOW}Stopping and removing all Docker containers...${NC}"
sudo docker ps -a -q | xargs -r sudo docker stop
sudo docker ps -a -q | xargs -r sudo docker rm -f

# Restart Docker service carefully without terminating our script
echo -e "${YELLOW}Restarting Docker service to ensure clean state...${NC}"
sudo systemctl restart docker || true
echo -e "${YELLOW}Waiting for Docker service to be fully available...${NC}"
sleep 5
sudo docker ps > /dev/null 2>&1 || sleep 5  # Extra wait if docker is not responding immediately

# Proactively free all ports we're going to use before even trying
echo -e "${YELLOW}Proactively freeing all required ports...${NC}"
echo -e "${YELLOW}Checking ports in use:${NC}"
sudo netstat -tuln | grep -E ':5435|:5050|:3000' || echo "No ports detected in use"

PORTS_TO_CHECK=("5435" "5050" "3000")
for port in "${PORTS_TO_CHECK[@]}"; do
  echo -e "${YELLOW}Proactively freeing port $port...${NC}"
  kill_process_on_port $port
done

# Try one more time to clean the network stack
echo -e "${YELLOW}Cleaning network stack with iptables...${NC}"
sudo iptables -t nat -F 2>/dev/null || true

# Now try to start containers
echo -e "${YELLOW}Starting containers after thorough cleanup...${NC}"
# Add trap to prevent script termination from subcommand failures
trap "echo -e '${YELLOW}Continuing despite error...${NC}'" ERR
sudo -E docker-compose -f docker-compose.dev.yml up -d || true
trap - ERR  # Reset trap

# Check if any containers are running regardless of previous command's result
RUNNING_CONTAINERS=$(sudo docker ps --filter "name=social-genius" --format "{{.Names}}" 2>/dev/null)
if [ -z "$RUNNING_CONTAINERS" ]; then
  echo -e "${RED}No containers are running. Attempting emergency mode...${NC}"
  # Modify ports as a last-ditch effort
  sudo cp docker-compose.dev.yml docker-compose.dev.yml.bak
  sudo sed -i 's/5435:5432/5437:5432/g' docker-compose.dev.yml
  sudo sed -i 's/"5050:80"/"5051:80"/g' docker-compose.dev.yml
  
  echo -e "${YELLOW}Trying with alternative ports in emergency mode...${NC}"
  sudo -E docker-compose -f docker-compose.dev.yml up -d || true
  USING_ALT_PORTS=true
else
  echo -e "${GREEN}Containers are running: ${RUNNING_CONTAINERS}${NC}"
fi

# Check if app container is running, which is what we really care about
APP_CONTAINER=$(sudo docker ps --filter "name=social-genius-app" --format "{{.Names}}" 2>/dev/null)

# Even if starting containers had an issue, check what's running
echo -e "${YELLOW}Checking container status after startup attempts...${NC}"
sudo docker ps

if [ -n "$APP_CONTAINER" ]; then
  echo -e "${GREEN}App container is running: $APP_CONTAINER${NC}"
  STARTUP_SUCCESS=true
else
  echo -e "${RED}App container failed to start. Checking other containers...${NC}"
  
  # Check for other social-genius containers
  OTHER_CONTAINERS=$(sudo docker ps --filter "name=social-genius" --format "{{.Names}}" 2>/dev/null)
  if [ -n "$OTHER_CONTAINERS" ]; then
    echo -e "${YELLOW}Some containers are running: ${OTHER_CONTAINERS}${NC}"
    echo -e "${YELLOW}Attempting to start app container specifically...${NC}"
    sudo docker-compose -f docker-compose.dev.yml up -d app || true
    
    # Check again if app is running
    APP_CONTAINER=$(sudo docker ps --filter "name=social-genius-app" --format "{{.Names}}" 2>/dev/null)
    if [ -n "$APP_CONTAINER" ]; then
      echo -e "${GREEN}App container successfully started!${NC}"
      STARTUP_SUCCESS=true
    else
      echo -e "${RED}App container still not running.${NC}"
      STARTUP_SUCCESS=false
    fi
  else
    echo -e "${RED}No Social Genius containers are running.${NC}"
    STARTUP_SUCCESS=false
  fi
fi

# Verify database connections and initialize tables if containers are running
if [ "$STARTUP_SUCCESS" = true ]; then
  echo -e "${YELLOW}Verifying database connection and tables...${NC}"
  
  # Try to run verify-db script without interrupting the flow
  if [ -f verify-db.js ]; then
    node verify-db.js || echo -e "${YELLOW}Database verification failed, but continuing anyway${NC}"
  else
    echo -e "${YELLOW}verify-db.js script not found - skipping database verification${NC}"
  fi

  # Display appropriate information based on success/failure
  echo -e "${GREEN}Development environment is available!${NC}"
  echo -e "${GREEN}Web app: http://localhost:3000${NC}"
  
  # Show the correct port for PostgreSQL and pgAdmin
  if [ "$USING_ALT_PORTS" = true ]; then
    echo -e "${GREEN}PostgreSQL: localhost:5437 (modified from default 5435)${NC}"
    echo -e "${GREEN}pgAdmin: http://localhost:5051 (modified from default 5050, login with admin@socialgenius.com / admin)${NC}"
    echo -e "${YELLOW}NOTE: Using alternative ports for this session due to port conflicts${NC}"
  else
    echo -e "${GREEN}PostgreSQL: localhost:5435${NC}"
    echo -e "${GREEN}pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)${NC}"
  fi
  
  # Show permission advice before showing logs
  echo -e "\n${YELLOW}IMPORTANT: For long-term use, it's better to fix Docker permissions:${NC}"
  echo -e "1. Add your user to the docker group: ${GREEN}sudo usermod -aG docker $USER${NC}"
  echo -e "2. Log out and back in for the changes to take effect"
  echo -e "3. Then you can use the regular ./start-dev.sh script without sudo"
else
  echo -e "${RED}Failed to start the application container despite recovery attempts.${NC}"
  echo -e "${YELLOW}The following may help:${NC}"
  echo -e "1. ${YELLOW}Check for port conflicts: ${GREEN}sudo netstat -tulnp | grep -E '5435|5050|3000'${NC}"
  echo -e "2. ${YELLOW}Restart your system${NC}"
  echo -e "3. ${YELLOW}Inspect Docker logs: ${GREEN}sudo journalctl -u docker.service${NC}"
  
  # Restore original docker-compose if we modified it but failed
  if [ -f docker-compose.dev.yml.bak ]; then
    echo -e "${YELLOW}Restoring original docker-compose.dev.yml...${NC}"
    sudo mv docker-compose.dev.yml.bak docker-compose.dev.yml
  fi
fi

# This is the critical change - ALWAYS show the logs regardless of success state
# Try to show logs for whatever containers are running
echo -e "\n${GREEN}Attempting to show application logs (press Ctrl+C to exit logs but keep containers running)...${NC}"
echo -e "${YELLOW}-------- Application Logs --------${NC}"

# Try to show app logs, but fallback to showing all container logs if app isn't available
if [ -n "$APP_CONTAINER" ]; then
  sudo docker-compose -f docker-compose.dev.yml logs -f app || sudo docker-compose -f docker-compose.dev.yml logs -f
else
  echo -e "${YELLOW}App container not available, showing logs for all containers...${NC}"
  sudo docker-compose -f docker-compose.dev.yml logs -f || echo -e "${RED}No logs available.${NC}"
fi