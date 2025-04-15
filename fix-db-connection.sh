#\!/bin/bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Fixing database connection issues...${NC}"

# Update the connection string in the postgres service file to prioritize hostname over IP
echo -e "${YELLOW}Updating postgres-service.ts to prioritize hostname...${NC}"

# Create backup of original file
cp services/postgres-service.ts services/postgres-service.ts.bak

# Apply fix to prioritize hostname over IP address
sed -i 's/172.18.0.2:5432/postgres:5432/g' services/postgres-service.ts

echo -e "${GREEN}Database connection settings updated successfully.${NC}"

# Check if containers are running
if docker ps | grep -q postgres; then
  echo -e "${YELLOW}Restarting app container to apply changes...${NC}"
  docker restart social-genius_app_1
  echo -e "${GREEN}App container restarted. Changes should take effect immediately.${NC}"
else
  echo -e "${YELLOW}Docker containers not running. Changes will apply on next start.${NC}"
  echo -e "${YELLOW}Run ./start-dev.sh to start the application.${NC}"
fi

echo -e "${GREEN}Fix completed. Your application should now connect to the database properly.${NC}"
echo -e "${YELLOW}If you still encounter issues, please run ./rebuild-dev.sh to completely rebuild the application.${NC}"
