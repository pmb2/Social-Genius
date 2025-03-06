#!/bin/bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Social Genius with sudo in production mode...${NC}"
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
  sudo docker-compose down
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

# Ask if user wants to rebuild
read -p "Would you like to rebuild the containers? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Rebuilding containers...${NC}"
  
  # Load API keys from .env file
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
  
  # Build with API keys
  sudo docker-compose build \
    --build-arg OPENAI_API_KEY=${OPENAI_API_KEY:-""} \
    --build-arg GROQ_API_KEY=${GROQ_API_KEY:-""} \
    --build-arg EXA_API_KEY=${EXA_API_KEY:-""} \
    --build-arg DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@postgres:5435/socialgenius"}
fi

# Start containers with sudo
echo -e "${YELLOW}Starting Social Genius production containers with sudo...${NC}"
sudo docker-compose up -d

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Production containers started successfully!${NC}"
  echo -e "${GREEN}Web app: http://localhost:3000${NC}"
  
  # Show logs option
  read -p "Would you like to view logs? [Y/n] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    sudo docker-compose logs -f app
  else
    echo -e "${GREEN}To view logs later, run: sudo docker-compose logs -f app${NC}"
  fi

  echo -e "\n${YELLOW}IMPORTANT: For long-term use, it's better to fix Docker permissions:${NC}"
  echo -e "1. Add your user to the docker group: ${GREEN}sudo usermod -aG docker $USER${NC}"
  echo -e "2. Log out and back in for the changes to take effect"
  echo -e "3. Then you can use the regular ./start-prod.sh script without sudo"
else
  echo -e "${RED}Failed to start containers. Please check the error messages above.${NC}"
fi