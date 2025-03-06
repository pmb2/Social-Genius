#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project name for container naming
PROJECT_NAME="social-genius"

echo -e "${YELLOW}Starting Social Genius in development mode...${NC}"

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
            echo -e "${YELLOW}Troubleshooting suggestions:${NC}"
            echo -e "1. Try manually restarting Docker: ${GREEN}sudo systemctl restart docker${NC}"
            echo -e "2. Check if Docker socket is accessible: ${GREEN}sudo ls -la /var/run/docker.sock${NC}"
            echo -e "3. Ensure current user is in the 'docker' group: ${GREEN}groups \$(whoami) | grep docker${NC}"
            echo -e "4. Docker logs may provide more info: ${GREEN}sudo journalctl -u docker -n 50${NC}"
            
            # Check if user is not in docker group and offer to add them
            if ! groups $(whoami) | grep -q "docker"; then
              echo -e "\n${YELLOW}Your user ($(whoami)) is not in the 'docker' group. This is often needed to use Docker without sudo.${NC}"
              read -p "Would you like to add your user to the docker group? [y/N] " -n 1 -r
              echo
              if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}Adding user to docker group...${NC}"
                if sudo usermod -aG docker $(whoami); then
                  echo -e "${GREEN}User added to docker group! You need to log out and back in for this to take effect.${NC}"
                  echo -e "${YELLOW}After logging out and back in, try running this script again.${NC}"
                else
                  echo -e "${RED}Failed to add user to docker group.${NC}"
                fi
              fi
            fi
            exit 1
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

if [ ! -z "$EXISTING_CONTAINERS" ]; then
  echo -e "${YELLOW}Found existing Social Genius containers:${NC}"
  echo "$EXISTING_CONTAINERS"
  
  read -p "Would you like to stop these containers? [Y/n] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo -e "${YELLOW}Stopping existing containers...${NC}"
    docker-compose -f docker-compose.dev.yml down
    echo -e "${GREEN}Existing containers stopped.${NC}"
  else
    echo -e "${RED}Cannot start new containers while old ones are running. Exiting.${NC}"
    exit 1
  fi
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

# Start the containers
echo -e "${YELLOW}Starting development containers...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# Check if containers started successfully
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Development containers started successfully!${NC}"
  echo -e "${GREEN}Web app: http://localhost:3000${NC}"
  echo -e "${GREEN}pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)${NC}"
  
  # Show logs option
  read -p "Would you like to view logs? [Y/n] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    docker-compose -f docker-compose.dev.yml logs -f app
  else
    echo -e "${GREEN}To view logs later, run: docker-compose -f docker-compose.dev.yml logs -f app${NC}"
  fi
else
  echo -e "${RED}Failed to start containers. Please check the error messages above.${NC}"
  exit 1
fi