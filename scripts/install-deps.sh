#!/bin/bash

# Install all dependencies from the module manifest

GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Installing dependencies from module manifest...${NC}"

# Get directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if module-manifest.json exists
MANIFEST_PATH="$PROJECT_ROOT/module-manifest.json"
if [ ! -f "$MANIFEST_PATH" ]; then
  echo -e "${RED}Error: module-manifest.json not found in $PROJECT_ROOT${NC}"
  exit 1
fi

# Extract required packages from the manifest
PACKAGES=$(node -e "
  const fs = require('fs');
  try {
    const manifest = JSON.parse(fs.readFileSync('$MANIFEST_PATH', 'utf8'));
    if (manifest.requiredPackages && Array.isArray(manifest.requiredPackages)) {
      console.log(manifest.requiredPackages.join(' '));
    }
  } catch (error) {
    console.error('Error parsing manifest:', error);
    process.exit(1);
  }
")

if [ -z "$PACKAGES" ]; then
  echo -e "${YELLOW}No packages found in manifest or manifest is invalid.${NC}"
  exit 1
fi

echo -e "${GREEN}Found packages to install: $PACKAGES${NC}"

# Check if running with Docker
IS_DOCKER=false
if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
  IS_DOCKER=true
  echo -e "${YELLOW}Detected Docker environment${NC}"
fi

# Install packages
if [ "$IS_DOCKER" = true ]; then
  # Inside Docker, install directly
  echo -e "${GREEN}Installing packages inside Docker container...${NC}"
  npm install $PACKAGES
else
  # Outside Docker, check if app container is running
  if docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" ps | grep -q "app.*Up"; then
    echo -e "${GREEN}Installing packages in Docker container...${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.dev.yml" exec app npm install $PACKAGES
  else
    echo -e "${GREEN}Installing packages locally...${NC}"
    cd "$PROJECT_ROOT" && npm install $PACKAGES
  fi
fi

# Update local package.json too if we're in Docker
if [ "$IS_DOCKER" = true ]; then
  echo -e "${GREEN}NOTE: Running inside Docker. You may need to update your host package.json as well.${NC}"
fi

echo -e "${GREEN}Dependencies installation complete!${NC}"