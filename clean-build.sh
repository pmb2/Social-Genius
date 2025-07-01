#!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

# Project name for container naming
PROJECT_NAME="social-genius"

echo -e "${BLUE}===== Social Genius Clean Build Script =====${NC}"
echo -e "${YELLOW}This script will clean up containers, volumes, and rebuild the application.${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${YELLOW}Docker is not running. Attempting to start Docker..."
  
  # Check if we're on macOS and try to start Docker Desktop
  if [ -d "/Applications/Docker.app" ]; then
    echo -e "${YELLOW}Starting Docker Desktop..."
    open -a Docker
    
    # Wait for Docker to start (max 60 seconds)
    echo -e "${YELLOW}Waiting for Docker to start (this may take a moment)..."
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

# Step 1: Stop and remove all existing containers
echo -e "\n${BLUE}STEP 1: Stopping all containers...${NC}"
docker-compose -f docker-compose.dev.yml down
echo -e "${GREEN}✓ Existing containers stopped and removed.${NC}"

# Step 2: Clean Docker build cache
echo -e "\n${BLUE}STEP 2: Cleaning Docker build cache...${NC}"
docker builder prune -f
echo -e "${GREEN}✓ Docker build cache cleaned.${NC}"

# Step 3: Remove volumes (optional - ask for confirmation)
read -p "Do you want to remove database volumes for a clean slate? This will delete all database data! (y/N): " REMOVE_VOLUMES
if [[ "$REMOVE_VOLUMES" == "y" || "$REMOVE_VOLUMES" == "Y" ]]; then
  echo -e "${YELLOW}Removing Docker volumes...${NC}"
  VOLUMES=$(docker volume ls -q | grep ${PROJECT_NAME})
  if [ -n "$VOLUMES" ]; then
    docker volume rm $VOLUMES
    echo -e "${GREEN}✓ Docker volumes removed.${NC}"
  else
    echo -e "${YELLOW}No volumes found to remove.${NC}"
  fi
else
  echo -e "${YELLOW}Skipping volume removal. Database data will be preserved.${NC}"
fi

# Step 4: Clean Node.js build artifacts
echo -e "\n${BLUE}STEP 4: Cleaning Node.js build artifacts...${NC}"
if [ -d "dist" ]; then 
  rm -rf dist
  echo -e "${GREEN}✓ Removed dist directory.${NC}"
fi
if [ -d ".next" ]; then 
  rm -rf .next
  echo -e "${GREEN}✓ Removed .next directory.${NC}"
fi
if [ -d "node_modules" ]; then
  read -p "Do you want to clean node_modules? This will require reinstalling all dependencies. (y/N): " CLEAN_MODULES
  if [[ "$CLEAN_MODULES" == "y" || "$CLEAN_MODULES" == "Y" ]]; then
    rm -rf node_modules
    echo -e "${GREEN}✓ Removed node_modules directory.${NC}"
  else
    echo -e "${YELLOW}Skipping node_modules removal.${NC}"
  fi
fi

# Step 5: Validate our patch files
echo -e "\n${BLUE}STEP 5: Validating patch files...${NC}"

# Make sure pg-patch.cjs exists and is executable
if [ -f "pg-patch.cjs" ]; then
  chmod +x pg-patch.cjs
  echo -e "${GREEN}✓ pg-patch.cjs is present and executable.${NC}"
else
  echo -e "${RED}× pg-patch.cjs is missing! This could cause PostgreSQL connection issues.${NC}"
  
  # Ask if we should create it based on the example in the code
  read -p "Would you like to recreate the pg-patch.cjs file? (Y/n): " CREATE_PATCH
  if [[ "$CREATE_PATCH" != "n" && "$CREATE_PATCH" != "N" ]]; then
    cat > pg-patch.cjs << 'EOF'
// This file is a pure CommonJS patch for the pg module
// Applied both at startup and by node_modules_patch.cjs

// Force the pg module to use the JavaScript implementation
process.env.NODE_PG_FORCE_NATIVE = '0';

function applyPgPatches() {
  try {
    console.log('Applying pg module patches...');
    
    // Force disable native mode before loading pg
    process.env.NODE_PG_FORCE_NATIVE = '0';
    
    // Prevent pg-native loading issue by patching Module._load
    const Module = require('module');
    const originalLoad = Module._load;
    
    // Override the module loading system temporarily
    Module._load = function(request, parent, isMain) {
      if (request === 'pg-native') {
        console.log('⚠️ Intercepted pg-native request, providing mock implementation');
        return { Client: null };
      }
      return originalLoad.apply(this, arguments);
    }
    
    // Load pg modules
    const pg = require('pg');
    const Pool = pg.Pool;
    const Client = pg.Client;
    
    // 1. Patch pg.Pool.prototype.Client directly
    if (pg && Pool && Pool.prototype) {
      Pool.prototype.Client = Client;
      console.log('✅ Successfully patched pg.Pool.prototype.Client');
    }
    
    // 2. Patch Pool.prototype.connect to ensure this.Client is set
    const originalConnect = Pool.prototype.connect;
    Pool.prototype.connect = function patchedConnect() {
      if (!this.Client) {
        this.Client = Client;
        console.log('❗ Fixed missing this.Client in Pool.connect');
      }
      return originalConnect.apply(this, arguments);
    };
    
    // 3. Monkey patch the newClient method which causes the error
    const originalNewClient = Pool.prototype.newClient;
    Pool.prototype.newClient = function patchedNewClient() {
      // Ensure this.Client is available
      if (!this.Client) {
        this.Client = Client;
        console.log('❗ Fixed missing this.Client in Pool.newClient');
      }
      
      // Call the original with proper this.Client now set
      try {
        return new this.Client(this.options);
      } catch (error) {
        console.error('Error creating client despite patch:', error);
        throw error;
      }
    };
    
    console.log('✅ Successfully patched pg Pool methods');
    
    // Restore original module loader
    Module._load = originalLoad;
    
    return true;
  } catch (e) {
    console.error('Failed to apply pg patches:', e);
    
    // Make sure to restore original module loader even if there's an error
    try {
      if (typeof Module !== 'undefined' && typeof originalLoad !== 'undefined') {
        Module._load = originalLoad;
      }
    } catch (restoreError) {
      console.error('Error restoring module loader:', restoreError);
    }
    
    return false;
  }
}

// Apply the patches immediately
const result = applyPgPatches();
console.log('Pg module patch result:', result);

// Export the function for potential reuse
module.exports = { applyPgPatches };
EOF
    chmod +x pg-patch.cjs
    echo -e "${GREEN}✓ pg-patch.cjs created successfully.${NC}"
  fi
fi

# Verify node_modules_patch.cjs exists
if [ -f "node_modules_patch.cjs" ]; then
  chmod +x node_modules_patch.cjs
  echo -e "${GREEN}✓ node_modules_patch.cjs is present and executable.${NC}"
else
  echo -e "${RED}× node_modules_patch.cjs is missing! This will cause patching issues.${NC}"
fi

# Check if db-diagnostic.cjs exists
if [ -f "db-diagnostic.cjs" ]; then
  chmod +x db-diagnostic.cjs
  echo -e "${GREEN}✓ db-diagnostic.cjs is present and executable.${NC}"
else
  echo -e "${YELLOW}× db-diagnostic.cjs is missing. This is optional for database diagnostics.${NC}"
fi

# Step 6: Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "\n${BLUE}STEP 6: Installing Node.js dependencies...${NC}"
  npm install
  echo -e "${GREEN}✓ Dependencies installed.${NC}"
else
  echo -e "\n${BLUE}STEP 6: Applying module patches...${NC}"
  node node_modules_patch.cjs
  echo -e "${GREEN}✓ Module patches applied.${NC}"
fi

# Step 7: Create Docker entrypoint script with fixes
echo -e "\n${BLUE}STEP 7: Creating Docker entrypoint script with PostgreSQL fixes...${NC}"

cat > pg-entry.sh << 'EOF'
#!/bin/bash
echo "Starting with database connection fixes..."

# Apply pg-patch
node pg-patch.cjs
# Apply node_modules_patch
node node_modules_patch.cjs
# Apply direct fixes
if [ -f fix-pg-modules.cjs ]; then
  node fix-pg-modules.cjs
fi
if [ -f fix-pg-constructor.cjs ]; then
  node fix-pg-constructor.cjs
fi

# Export environment variables
export NODE_OPTIONS="--require=/app/pg-constructor-fix-loader.js --max-old-space-size=4096"
export NODE_PG_FORCE_NATIVE=0
export PG_DEBUG=true
export DEBUG_DATABASE=true

echo "All fixes applied. Starting application..."
npm run dev
EOF
chmod +x pg-entry.sh
echo -e "${GREEN}✓ pg-entry.sh created successfully.${NC}"

# Step 8: Create modified docker-compose file with fixes
echo -e "\n${BLUE}STEP 8: Creating fixed docker-compose.yml...${NC}"
cat > docker-compose.dev.fixed.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL with pgvector
  postgres:
    image: pgvector/pgvector:pg14
    ports:
      - "5435:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: socialgenius
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - social_genius_network

  # Node.js application with PostgreSQL patches
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - pg_fixes:/app/fixes
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/socialgenius
      DATABASE_URL_DOCKER: postgresql://postgres:postgres@postgres:5432/socialgenius
      NODE_PG_FORCE_NATIVE: '0'
      PG_DEBUG: 'true'
      DEBUG_DATABASE: 'true'
      RUNNING_IN_DOCKER: 'true'
      NODE_OPTIONS: "--require=/app/pg-constructor-fix-loader.js --max-old-space-size=4096"
    depends_on:
      - postgres
    entrypoint: ["/bin/bash", "/app/pg-entry.sh"]
    networks:
      - social_genius_network
    restart: unless-stopped

  # Headless browser service for compliance checks
  browser-api:
    build:
      context: ./browser-use-api
      dockerfile: Dockerfile
    ports:
      - "5050:5000"
    volumes:
      - browser_cookies:/app/cookies
    restart: unless-stopped
    networks:
      - social_genius_network

networks:
  social_genius_network:
    driver: bridge

volumes:
  postgres_data:
  pg_fixes:
  browser_cookies:
EOF
echo -e "${GREEN}✓ docker-compose.dev.fixed.yml created successfully.${NC}"

# Step 9: Rebuild Docker images with fixed configuration
echo -e "\n${BLUE}STEP 9: Rebuilding Docker images with PostgreSQL fixes...${NC}"
NODE_PG_FORCE_NATIVE=0 docker-compose -f docker-compose.dev.fixed.yml build --no-cache
echo -e "${GREEN}✓ Docker images rebuilt successfully with fixes.${NC}"

# Step 10: Summary and next steps
echo -e "\n${BLUE}===== Clean Build Complete =====${NC}"
echo -e "${GREEN}✓ All cleanup and build steps have been completed with PostgreSQL fixes.${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  - Run ${GREEN}docker-compose -f docker-compose.dev.fixed.yml up -d${NC} to start containers with all fixes"
echo -e "  - Or use ${GREEN}./fix-local-only.sh${NC} to run the app locally with all fixes if Docker still has I/O errors"
echo -e "  - Access the web app at ${GREEN}http://localhost:3000${NC}"
echo -e "  - Access Browser API at ${GREEN}http://localhost:5050${NC}"

# If remove volumes was selected, suggest running the init-db script
if [[ "$REMOVE_VOLUMES" == "y" || "$REMOVE_VOLUMES" == "Y" ]]; then
  echo -e "\n${YELLOW}Since you removed the database volumes, you may need to initialize the database.${NC}"
  echo -e "You can do this by visiting ${GREEN}http://localhost:3000/init-db-script${NC} after starting the app."
fi

# Ask if they want to start the containers now
read -p "Would you like to start the containers now? (Y/n): " START_NOW
if [[ "$START_NOW" != "n" && "$START_NOW" != "N" ]]; then
  echo -e "${YELLOW}Starting containers with PostgreSQL fixes...${NC}"
  NODE_PG_FORCE_NATIVE=0 PG_DEBUG=true DEBUG_DATABASE=true docker-compose -f docker-compose.dev.fixed.yml up -d
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Containers started successfully with all fixes applied!${NC}"
    echo -e "${YELLOW}Showing application logs (Ctrl+C to exit logs without stopping containers)...${NC}"
    docker-compose -f docker-compose.dev.fixed.yml logs -f app
  else
    echo -e "${RED}Failed to start containers due to Docker I/O errors.${NC}"
    echo -e "${YELLOW}You can try running locally with:${NC} ${GREEN}./fix-local-only.sh${NC}"
  fi
else
  echo -e "${YELLOW}Skipping container start. You can start them later with:${NC}"
  echo -e "${GREEN}docker-compose -f docker-compose.dev.fixed.yml up -d${NC}"
fi

echo -e "\n${BLUE}===== Social Genius Clean Build Complete =====${NC}"
