#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Social Genius containers with sudo...${NC}"
echo -e "${YELLOW}This script runs Docker commands with sudo to bypass permission issues.${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
  exit 1
fi

# Check for existing containers
echo -e "${YELLOW}Checking for existing Social Genius containers...${NC}"
CONTAINERS=$(sudo docker ps -a --filter name=social-genius --format "{{.Names}}" 2>/dev/null || echo "")

if [ -z "$CONTAINERS" ]; then
  echo -e "${YELLOW}No Social Genius containers found to stop.${NC}"
  exit 0
fi

echo -e "${YELLOW}Found the following containers:${NC}"
echo "$CONTAINERS"

# Determine if we should remove volumes
read -p "Would you like to remove the database volumes? (data will be lost) [y/N] " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Stopping containers and removing volumes...${NC}"
  # Try production compose file first
  if sudo docker-compose down -v; then
    echo -e "${GREEN}Production containers stopped and volumes removed.${NC}"
  # If that fails, try development compose file
  elif sudo docker-compose -f docker-compose.dev.yml down -v; then
    echo -e "${GREEN}Development containers stopped and volumes removed.${NC}"
  else
    echo -e "${RED}Failed to stop containers with compose. Stopping containers manually.${NC}"
    sudo docker stop $(sudo docker ps -a --filter name=social-genius -q)
    sudo docker rm $(sudo docker ps -a --filter name=social-genius -q)
    echo -e "${GREEN}Containers stopped and removed.${NC}"
  fi
else
  echo -e "${YELLOW}Stopping containers and preserving volumes...${NC}"
  # Try production compose file first
  if sudo docker-compose down; then
    echo -e "${GREEN}Production containers stopped.${NC}"
  # If that fails, try development compose file
  elif sudo docker-compose -f docker-compose.dev.yml down; then
    echo -e "${GREEN}Development containers stopped.${NC}"
  else
    echo -e "${RED}Failed to stop containers with compose. Stopping containers manually.${NC}"
    sudo docker stop $(sudo docker ps -a --filter name=social-genius -q)
    sudo docker rm $(sudo docker ps -a --filter name=social-genius -q)
    echo -e "${GREEN}Containers stopped and removed.${NC}"
  fi
fi

# Show running containers
echo -e "${GREEN}Current running containers:${NC}"
sudo docker ps

echo -e "\n${YELLOW}IMPORTANT: For long-term use, it's better to fix Docker permissions:${NC}"
echo -e "1. Add your user to the docker group: ${GREEN}sudo usermod -aG docker $USER${NC}"
echo -e "2. Log out and back in for the changes to take effect"
echo -e "3. Then you can use the regular ./stop.sh script without sudo"