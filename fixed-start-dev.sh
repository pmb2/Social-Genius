#!/bin/bash

echo "Starting Social Genius with fixed database connection..."

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose down -v

# Start with the fixed configuration
echo "Starting with fixed configuration..."
docker-compose -f docker-compose-fixed.yml up -d

# Wait for containers to start
echo "Waiting for containers to start..."
sleep 10

# Copy the fixed postgres service
echo "Applying database connection fix..."
docker exec social-genius_app_1 cp /app/services/postgres-service-fixed.ts /app/services/postgres-service.ts

# Show logs
echo "Showing logs..."
docker-compose -f docker-compose-fixed.yml logs -f app
