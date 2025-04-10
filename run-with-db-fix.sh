#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}===== Social Genius Development Startup with PostgreSQL Fixes =====${NC}"

# Create any missing files
echo -e "${YELLOW}Creating required patch files...${NC}"

# Stop any existing containers
echo -e "${YELLOW}Stopping any existing containers...${NC}"
docker-compose -f docker-compose.dev.yml down

# Set environment variables
export NODE_PG_FORCE_NATIVE=0
export PG_DEBUG=true
export DEBUG_DATABASE=true

# Start the containers
echo -e "${YELLOW}Starting containers...${NC}"
echo -e "${YELLOW}Running: docker-compose -f docker-compose.dev.yml up${NC}"
docker-compose -f docker-compose.dev.yml up