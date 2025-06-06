#!/bin/bash

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}EMERGENCY FIX: Deploying bare-bones maintenance mode${NC}"

# Stop all running containers
echo -e "${YELLOW}Stopping all containers...${NC}"
docker-compose down --remove-orphans
docker-compose -f docker-compose.dev.yml down --remove-orphans
docker-compose -f docker-compose-fix.yml down --remove-orphans
docker-compose -f docker-compose.simple.yml down --remove-orphans
docker-compose -f docker-compose.minimal.yml down --remove-orphans

# Clean up any existing containers
echo -e "${YELLOW}Cleaning up containers...${NC}"
docker ps -a | grep -E "social-genius|nginx" | awk '{print $1}' | xargs -r docker rm -f

# Start the simple setup - direct use of docker run for maximum control
echo -e "${YELLOW}Starting standalone Node.js server...${NC}"
docker network create sg_network 2>/dev/null || true

# Start the app container
echo -e "${YELLOW}Starting app container...${NC}"
docker run -d --name sg-app \
  --network sg_network \
  -p 3000:3000 \
  -v "$(pwd)/simple-server.js:/app/server.js" \
  -w /app \
  node:18-alpine \
  node server.js

# Wait a moment for the app to start
sleep 2

# Check if the app container is running
if [ "$(docker ps -q -f name=sg-app)" ]; then
  echo -e "${GREEN}App container started successfully${NC}"
else
  echo -e "${RED}Failed to start app container${NC}"
  docker logs sg-app
  exit 1
fi

# Start the nginx container
echo -e "${YELLOW}Starting nginx container...${NC}"
docker run -d --name sg-nginx \
  --network sg_network \
  -p 8080:80 \
  -v "$(pwd)/src/nginx/conf/simple.conf:/etc/nginx/conf.d/default.conf" \
  nginx:alpine

# Check if nginx is running
if [ "$(docker ps -q -f name=sg-nginx)" ]; then
  echo -e "${GREEN}Nginx container started successfully${NC}"
else
  echo -e "${RED}Failed to start nginx container${NC}"
  docker logs sg-nginx
  exit 1
fi

echo -e "${YELLOW}Checking container logs...${NC}"
echo -e "${YELLOW}App logs:${NC}"
docker logs sg-app

echo -e "${YELLOW}Nginx logs:${NC}"
docker logs sg-nginx

echo -e "${GREEN}Emergency fix complete!${NC}"
echo -e "${YELLOW}Site should be accessible at:${NC}"
echo -e "${YELLOW}- http://localhost:8080/ (via nginx)${NC}"
echo -e "${YELLOW}- http://localhost:3000/ (direct to Node.js)${NC}"

echo -e "${YELLOW}Testing local access...${NC}"
curl -s localhost:8080/health && echo -e " ${GREEN}✓ Nginx health check passed${NC}" || echo -e " ${RED}✗ Nginx health check failed${NC}"
curl -s localhost:3000/health && echo -e " ${GREEN}✓ App health check passed${NC}" || echo -e " ${RED}✗ App health check failed${NC}"

echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Check if http://app.social-genius.com now returns a maintenance page"
echo -e "2. Fix the underlying issues in your Next.js application"
echo -e "3. Specifically fix the path-to-regexp issue in server.cjs by removing the invalid route"
echo
echo -e "${YELLOW}To check server logs:${NC}"
echo -e "docker logs sg-app"
echo -e "docker logs sg-nginx"
echo
echo -e "${YELLOW}To stop emergency servers:${NC}"
echo -e "docker stop sg-app sg-nginx"
echo -e "docker rm sg-app sg-nginx"