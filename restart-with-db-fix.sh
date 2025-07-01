#!/bin/bash

echo "=== Social Genius App Restart ==="
echo "This script will restart the app with proper database fixes"

# Stop all containers
echo "Stopping all containers..."
docker-compose -f docker-compose.dev.yml down

# Clean up any lingering volumes if requested
if [[ "$1" == "--clean" ]]; then
  echo "Cleaning up volumes..."
  docker volume rm social-genius_postgres_data social-genius_redis_data || true
fi

# Rebuild the containers with our fixes
echo "Building containers with updated configuration..."
docker-compose -f docker-compose.dev.yml build

# Start everything up
echo "Starting all services..."
docker-compose -f docker-compose.dev.yml up -d

# Allow some time for initialization
echo "Waiting for services to initialize..."
sleep 5

# Check if app is responding
echo "Checking application status..."
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000 || echo "App not yet responding, it may need more time to initialize"

echo
echo "=== Social Genius App Restart Complete ==="
echo "You can access the application at: http://localhost:3000"
echo "To see app logs: docker-compose -f docker-compose.dev.yml logs -f app"
echo