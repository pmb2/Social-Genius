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

# Check for existing containers with the project name
FOUND_CONTAINERS=$(docker ps -a --filter name=${PROJECT_NAME} --format "{{.Names}}")

if [ -n "$FOUND_CONTAINERS" ]; then
  echo -e "${YELLOW}Found existing Social Genius containers:${NC}"
  echo "$FOUND_CONTAINERS"
  
  read -p "Would you like to stop these containers? [Y/n] " CHOICE
  if [[ "$CHOICE" == "n" || "$CHOICE" == "N" ]]; then
    echo -e "${RED}Cannot start new containers while old ones are running. Exiting.${NC}"
    exit 1
  else
    echo -e "${YELLOW}Stopping existing containers...${NC}"
    docker-compose -f docker-compose.dev.yml down
    echo -e "${GREEN}Existing containers stopped.${NC}"
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

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Development containers started successfully!${NC}"
  echo -e "${GREEN}Web app: http://localhost:3001${NC}"
  echo -e "${GREEN}pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)${NC}"
  
  # Show logs option
  read -p "Would you like to view logs? [Y/n] " VIEW_LOGS
  if [[ "$VIEW_LOGS" == "n" || "$VIEW_LOGS" == "N" ]]; then
    echo -e "${GREEN}To view logs later, run: docker-compose -f docker-compose.dev.yml logs -f app${NC}"
  else
    docker-compose -f docker-compose.dev.yml logs -f app
  fi
else
  echo -e "${RED}Failed to start containers. Please check the error messages above.${NC}"
  exit 1
fi