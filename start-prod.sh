#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# Project name for container naming
PROJECT_NAME="social-genius"

echo -e "${YELLOW}Starting Social Genius in production mode for domain www.gbp.backus.agency...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

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

# Create directories for certbot if they don't exist
mkdir -p certbot/conf
mkdir -p certbot/www

# Check if SSL certificates already exist, if not, we need to get them
if [ ! -d "certbot/conf/live/www.gbp.backus.agency" ]; then
  echo -e "${YELLOW}SSL certificates not found. Generating certificates...${NC}"
  
  # Start nginx container temporarily for Let's Encrypt validation
  docker-compose -f docker-compose.prod.yml up -d nginx
  
  # Run certbot to get the certificates
  docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    --network social_genius_network \
    certbot/certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@backus.agency \
    --agree-tos --no-eff-email \
    -d www.gbp.backus.agency -d gbp.backus.agency
  
  # Stop the temporary nginx container
  docker-compose -f docker-compose.prod.yml stop nginx
  
  if [ ! -d "certbot/conf/live/www.gbp.backus.agency" ]; then
    echo -e "${RED}Failed to obtain SSL certificates. Check domain DNS settings and try again.${NC}"
    echo -e "${YELLOW}Ensure DNS records for www.gbp.backus.agency and gbp.backus.agency point to this server's IP address.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}SSL certificates obtained successfully!${NC}"
fi

# Check for port conflicts and handle them intelligently
echo -e "${YELLOW}Checking for port conflicts...${NC}"
ORIGINAL_PORTS=(80 443 3000 5432)
FINAL_PORTS=()
PROJECT_NAME="social-genius"

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
      # For production, we need specific ports for web traffic
      if [ $PORT -eq 80 ] || [ $PORT -eq 443 ]; then
        echo -e "${RED}Port $PORT is used by another application. This port is required for web traffic in production.${NC}"
        echo -e "${YELLOW}Please free up this port and try again.${NC}"
        exit 1
      else
        # For other ports, find an alternative
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
        if [ $PORT -eq 3000 ]; then
          APP_PORT=$ALT_PORT
        elif [ $PORT -eq 5432 ]; then
          DB_PORT=$ALT_PORT
        fi
      fi
    fi
  else
    # Port is free, use as is
    echo -e "${GREEN}Port $PORT is free.${NC}"
    FINAL_PORTS+=($PORT)
  fi
done

# Create a temporary docker-compose override file if needed
if [ -n "$APP_PORT" ] || [ -n "$DB_PORT" ]; then
  echo -e "${YELLOW}Creating temporary docker-compose override for custom ports...${NC}"
  
  cat > docker-compose.prod.override.yml << EOF
version: '3.8'
services:
EOF

  if [ -n "$APP_PORT" ]; then
    cat >> docker-compose.prod.override.yml << EOF
  app:
    ports:
      - "${APP_PORT}:3000"
EOF
  fi
  
  if [ -n "$DB_PORT" ]; then
    cat >> docker-compose.prod.override.yml << EOF
  postgres:
    ports:
      - "${DB_PORT}:5432"
EOF
  fi
  
  echo -e "${GREEN}Created docker-compose override file with custom ports.${NC}"
  
  # Start all services with override
  echo -e "${YELLOW}Starting all production services with custom ports...${NC}"
  docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml up -d
else
  # No port conflicts, start normally
  echo -e "${YELLOW}Starting all production services...${NC}"
  docker-compose -f docker-compose.prod.yml up -d
fi

# Check if containers are running
if [ -f docker-compose.prod.override.yml ]; then
  RUNNING_CONTAINERS=$(docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml ps --services --filter "status=running" | wc -l)
else
  RUNNING_CONTAINERS=$(docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | wc -l)
fi

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
  echo -e "${GREEN}Production deployment started successfully!${NC}"
  
  # Show actual port information if using custom ports
  if [ -f docker-compose.prod.override.yml ]; then
    echo -e "${GREEN}Your application is now available at https://www.gbp.backus.agency${NC}"
    if [ -n "$APP_PORT" ]; then
      echo -e "${YELLOW}Note: Using custom port ${APP_PORT} for internal app service.${NC}"
    fi
    if [ -n "$DB_PORT" ]; then
      echo -e "${YELLOW}Note: Using custom port ${DB_PORT} for database service.${NC}"
    fi
    
    # Provide information about logs with override
    echo -e "${YELLOW}View logs with: docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml logs -f${NC}"
    echo -e "${YELLOW}For app logs only: docker-compose -f docker-compose.prod.yml -f docker-compose.prod.override.yml logs -f app${NC}"
  else
    echo -e "${GREEN}Your application is now available at https://www.gbp.backus.agency${NC}"
    
    # Provide information about logs
    echo -e "${YELLOW}View logs with: docker-compose -f docker-compose.prod.yml logs -f${NC}"
    echo -e "${YELLOW}For app logs only: docker-compose -f docker-compose.prod.yml logs -f app${NC}"
  fi
else
  echo -e "${RED}Containers may have started but aren't running. Check docker ps for status.${NC}"
  docker ps -a
  exit 1
fi