#!/bin/bash

# start-dev-quiet.sh - Starts the development server with minimal console noise
# Only shows important application logs, with focus on Google auth and browser API

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}Starting development server with clean console output...${NC}"

# Maximum suppression of Next.js/webpack logs
export NEXT_TELEMETRY_DISABLED=1
export NEXT_RUNTIME_LOGGING=silent
export NEXT_WEBPACK_LOGGING=none
export NEXT_SUPPRESS_LOGS=1
export FAST_REFRESH=true
export DISABLE_FAST_REFRESH_LOGS=true
export NEXT_FAST_REFRESH_QUIET=true
export NEXT_DISABLE_SERVER_LOGS=1
export NEXT_DISABLE_BUILD_LOGS=1
export WEBPACK_LOGGING_LEVEL=none
export WEBPACK_LOGGING=none
export NEXTJS_SHOW_WARNINGS=0
export DEBUG=app:error*
export NEXT_IGNORE_REACT_ERROR_OVERLAY=1
export PROGRESS=none
export NODE_ENV=production # Quieter webpack in production mode
export NODE_NO_WARNINGS=1

# Disable debug logs for non-critical features
export DEBUG_SESSION=false
export DEBUG_MIDDLEWARE=false
export DEBUG_AUTH=false
export DEBUG_DASHBOARD=false
export DEBUG_WEBPACK=false
export NO_COLOR=1

# KEEP debug logs for business-critical features
export DEBUG_BUSINESS=true
export DEBUG_GOOGLE_AUTH=true
export DEBUG_BROWSER_API=true
export SUPPRESS_FAST_REFRESH_LOGS=true

# Clean shutdown of existing containers
echo -e "${YELLOW}Stopping any running containers...${NC}"
docker-compose -f docker-compose.dev.yml down -v --remove-orphans

# Start the containers in detached mode
echo -e "${YELLOW}Starting containers...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# Wait for containers to start
echo -e "${YELLOW}Waiting for containers to start...${NC}"
sleep 5

# Check if containers are running
echo -e "${YELLOW}Checking container status...${NC}"
RUNNING_CONTAINERS=$(docker-compose -f docker-compose.dev.yml ps --services --filter "status=running" | wc -l)

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
  echo -e "${GREEN}Containers are running! Showing filtered logs...${NC}"
  echo -e "${YELLOW}Focusing on Google Auth and browser-use-api logs. Webpack noise is suppressed.${NC}"
  
  # Comprehensive log filtering pattern - only show relevant logs
  # This pattern aggressively filters out webpack, compilation, Next.js framework logs, and health checks
  # while preserving business logic, auth flows, and browser-use-api logs
  docker-compose -f docker-compose.dev.yml logs -f | grep -v -E '(Compiled|compiled|webpack|^app_1|modules\)$|BUILT MODULES|MODULE SNAPSHOT|HMR update|cached modules|Checking watch|Cache asset|^App \(|Loaded|Invalidating|warn\s+-|ℹ\s+wait|ℹ\s+event|✓ Compiled|Web Vitals|NextJS|^▲\s|hot module replacement|️\s+Using|⠋\s|⠙\s|⠹\s|⠸\s|⠼\s|⠴\s|⠦\s|⠧\s|⠇\s|⠏\s|⚡|info\s+-|app_1\s+\|.+fast refresh|event compiled client|\.css \(in app-pages-browser\)|GET /health HTTP|localhost:[0-9]+.*HEAD|assets by path|asset |% \(0 affected|% modules flagged|% of exports|% root snapshot|queue items processed|chunk groups|new snapshots created|File info in cache|Directory info in cache|Managed items|\+ [0-9]+ hidden lines|modules hashed|0% children snapshot|entries tested|entries updated|\s+$|LOG from webpack|\[compared for emit\]|\[emitted\]|\[cached\]|compiled successfully|Ready in [0-9]+ms|bytes|Entrypoint|orphan modules|runtime modules|modules by path|\+ [0-9]+ modules|\+ [0-9]+ assets|Replaced "process\.env|cacheable modules|[0-9]+% \([0-9]+ affected|javascript modules|css modules|File timestamp snapshot|Directory timestamp snapshot|Missing items snapshot|code generated [\(0-9]|really resolved|Warning:|Component Stack:|Source map error|Stack|Resource URL|The resource at|Unable to check|Failed to load|\<anonymous code\>|[0-9]+\s+[a-zA-Z0-9$_@]|snapshot|[0-9]+% children|Managed files)' | grep -E '(BUSINESS|Google|Auth|browser|login|BROWSER|session|profile|business|Chrome|task_id|trace|error|Error|WARNING|CRITICAL|SUCCESS|api_1|^browser|failed|^\[)'
  
  # Fallback to a more permissive filter if the previous one filters too much
  echo -e "${YELLOW}Log stream may have been interrupted. Showing logs with basic filtering...${NC}"
  docker-compose -f docker-compose.dev.yml logs -f | grep -v -E '(Compiled|webpack|modules\)$|hot module replacement)'
else
  echo -e "${RED}Containers failed to start properly. Check the status with 'docker-compose ps'${NC}"
  docker-compose -f docker-compose.dev.yml ps
fi
