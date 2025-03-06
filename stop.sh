#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project name for container naming
PROJECT_NAME="social-genius"

echo -e "${YELLOW}Stopping Social Genius containers...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${YELLOW}Docker is not running. Attempting to start Docker...${NC}"
  
  # Detect OS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo -e "${YELLOW}Detected macOS. Starting Docker Desktop...${NC}"
    open -a Docker
    
    # Wait for Docker to start (max 60 seconds)
    echo -e "${YELLOW}Waiting for Docker to start (this may take a moment)...${NC}"
    for i in {1..60}; do
      if docker info > /dev/null 2>&1; then
        echo -e "${GREEN}Docker started successfully!${NC}"
        break
      fi
      
      if [ $i -eq 60 ]; then
        echo -e "${RED}Timed out waiting for Docker to start. Please start Docker manually and try again.${NC}"
        exit 1
      fi
      
      sleep 1
    done
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo -e "${YELLOW}Detected Linux. Attempting to start Docker service...${NC}"
    if command -v systemctl > /dev/null 2>&1; then
      # systemd
      if sudo systemctl start docker; then
        echo -e "${GREEN}Docker service started successfully!${NC}"
        
        # Wait for Docker to be ready - increased timeout to 30 seconds
        echo -e "${YELLOW}Waiting for Docker daemon to be accessible (up to 30 seconds)...${NC}"
        for i in {1..30}; do
          if docker info > /dev/null 2>&1; then
            echo -e "${GREEN}Docker is now ready!${NC}"
            break
          fi
          
          # Progress indicator
          if [ $((i % 5)) -eq 0 ]; then
            echo -e "${YELLOW}Still waiting for Docker daemon to respond (${i}/30 seconds)...${NC}"
            
            # At 15 seconds, try to restart the service
            if [ $i -eq 15 ]; then
              echo -e "${YELLOW}Attempting to restart Docker service...${NC}"
              sudo systemctl restart docker
            fi
            
            # Display Docker service status for debugging
            if [ $i -eq 20 ]; then
              echo -e "${YELLOW}Docker service status:${NC}"
              sudo systemctl status docker --no-pager | head -15
            fi
          fi
          
          if [ $i -eq 30 ]; then
            echo -e "${RED}Docker service started but Docker is not responding after 30 seconds.${NC}"
            echo -e "${YELLOW}Since you're trying to stop containers, continuing anyway...${NC}"
            break
          fi
          
          sleep 1
        done
      else
        echo -e "${RED}Failed to start Docker service. You may need to install Docker or start it manually.${NC}"
        exit 1
      fi
    else
      # non-systemd
      if sudo service docker start; then
        echo -e "${GREEN}Docker service started successfully!${NC}"
        sleep 2
      else
        echo -e "${RED}Failed to start Docker service. You may need to install Docker or start it manually.${NC}"
        exit 1
      fi
    fi
  else
    # Unknown OS
    echo -e "${RED}Could not detect OS. Please start Docker manually and try again.${NC}"
    exit 1
  fi
  
  # Final check to make sure Docker is running
  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is still not running. Please start Docker manually and try again.${NC}"
    exit 1
  fi
fi

# Check for existing containers with the project name
EXISTING_CONTAINERS=$(docker ps -a --filter name=${PROJECT_NAME} --format "{{.Names}}")

if [ -z "$EXISTING_CONTAINERS" ]; then
  echo -e "${YELLOW}No Social Genius containers found to stop.${NC}"
  exit 0
fi

echo -e "${YELLOW}Found the following containers:${NC}"
echo "$EXISTING_CONTAINERS"

# Determine if we should remove volumes
read -p "Would you like to remove the database volumes? (data will be lost) [y/N] " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Stopping containers and removing volumes...${NC}"
  # Try production compose file first
  if docker-compose down -v; then
    echo -e "${GREEN}Production containers stopped and volumes removed.${NC}"
  # If that fails, try development compose file
  elif docker-compose -f docker-compose.dev.yml down -v; then
    echo -e "${GREEN}Development containers stopped and volumes removed.${NC}"
  else
    echo -e "${RED}Failed to stop containers with compose. Stopping containers manually.${NC}"
    docker stop $(docker ps -a --filter name=${PROJECT_NAME} -q)
    docker rm $(docker ps -a --filter name=${PROJECT_NAME} -q)
    echo -e "${GREEN}Containers stopped and removed.${NC}"
  fi
else
  echo -e "${YELLOW}Stopping containers and preserving volumes...${NC}"
  # Try production compose file first
  if docker-compose down; then
    echo -e "${GREEN}Production containers stopped.${NC}"
  # If that fails, try development compose file
  elif docker-compose -f docker-compose.dev.yml down; then
    echo -e "${GREEN}Development containers stopped.${NC}"
  else
    echo -e "${RED}Failed to stop containers with compose. Stopping containers manually.${NC}"
    docker stop $(docker ps -a --filter name=${PROJECT_NAME} -q)
    docker rm $(docker ps -a --filter name=${PROJECT_NAME} -q)
    echo -e "${GREEN}Containers stopped and removed.${NC}"
  fi
fi

# Show running containers
echo -e "${GREEN}Current running containers:${NC}"
docker ps