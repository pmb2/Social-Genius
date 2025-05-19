#!/bin/bash

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Testing network connectivity for Social Genius...${NC}"

# Check Docker status
echo -e "${YELLOW}Checking Docker status...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Docker is not running!${NC}"
  exit 1
else
  echo -e "${GREEN}Docker is running${NC}"
fi

# List running containers
echo -e "${YELLOW}Listing running containers:${NC}"
docker ps

# Check if app container is running
app_container=$(docker ps -q --filter "name=social-genius_app")
if [ -z "$app_container" ]; then
  echo -e "${RED}App container not found. Please make sure it's running.${NC}"
  exit 1
else
  echo -e "${GREEN}App container is running: $app_container${NC}"
fi

# Check container networking
echo -e "${YELLOW}Checking container networking...${NC}"
echo -e "${YELLOW}Container IP address:${NC}"
docker exec $app_container hostname -i

# Check listening ports inside container
echo -e "${YELLOW}Checking listening ports inside container:${NC}"
docker exec $app_container netstat -tulpn 2>/dev/null || echo -e "${YELLOW}netstat not available in container${NC}"

# Try to install and use netstat if not available
docker exec $app_container sh -c "if ! command -v netstat &> /dev/null; then apt-get update && apt-get install -y net-tools && netstat -tulpn; fi" 2>/dev/null || echo -e "${YELLOW}Could not install netstat${NC}"

# Check if Next.js is binding to 0.0.0.0
echo -e "${YELLOW}Checking Next.js binding address:${NC}"
docker logs $app_container 2>&1 | grep -E "Ready on|Starting server" | tail -5

# Test connectivity from inside the container
echo -e "${YELLOW}Testing internal connectivity:${NC}"
docker exec $app_container curl -s http://localhost:3000/health && echo -e "${GREEN}Internal health check successful${NC}" || echo -e "${RED}Internal health check failed${NC}"

# Test connectivity from host
echo -e "${YELLOW}Testing host-to-container connectivity:${NC}"
curl -s http://localhost:3000/health && echo -e "${GREEN}External health check successful${NC}" || echo -e "${RED}External health check failed${NC}"

# Check for port conflicts
echo -e "${YELLOW}Checking for port conflicts on host:${NC}"
lsof -i :3000 | grep -v COMMAND && echo -e "${YELLOW}Port conflicts found on 3000${NC}" || echo -e "${GREEN}No port conflicts on 3000${NC}"

# Final verdict
echo -e "${YELLOW}Connectivity check complete${NC}"
echo -e "${YELLOW}Is the container accessible from inside? $(docker exec $app_container curl -s http://localhost:3000/health > /dev/null && echo -e "${GREEN}Yes${NC}" || echo -e "${RED}No${NC}")${NC}"
echo -e "${YELLOW}Is the container accessible from host? $(curl -s http://localhost:3000/health > /dev/null && echo -e "${GREEN}Yes${NC}" || echo -e "${RED}No${NC}")${NC}"

echo ""
echo -e "${YELLOW}Suggested next steps:${NC}"
echo -e "1. If server is binding to the wrong address, update server.cjs to use hostname = '0.0.0.0'"
echo -e "2. If port conflicts are found, update port mappings in docker-compose files"
echo -e "3. If custom server isn't working, run 'docker-compose up -d --force-recreate' to rebuild with latest changes"
echo -e "4. Check logs with 'docker logs $app_container'"