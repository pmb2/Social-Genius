#!/bin/bash

# Set pg-specific environment variables
export NODE_PG_FORCE_NATIVE=0

# Apply pg patch before running anything else
echo "Applying PostgreSQL patches..."
node -e "require('./pg-native-loader.cjs'); console.log('Successfully loaded pg-native interceptor');"

# Testing pg patches
echo "Testing PostgreSQL patches..."
node test-pg-patches.cjs

# Stop any existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

# Rebuild the application
echo "Rebuilding the application..."
docker-compose -f docker-compose.dev.yml build app

# Start the application
echo "Starting the application..."
docker-compose -f docker-compose.dev.yml up -d

# Follow logs
echo "Following logs (Ctrl+C to stop following, containers will continue running)..."
docker-compose -f docker-compose.dev.yml logs -f app