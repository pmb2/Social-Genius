#!/bin/bash

echo "=== Social Genius App Restart ==="
echo "Stopping current containers..."
docker-compose -f docker-compose.dev.yml down

echo "Rebuilding the app container..."
docker-compose -f docker-compose.dev.yml build app

echo "Starting all containers..."
docker-compose -f docker-compose.dev.yml up -d

echo "=== Waiting for services to initialize ==="
sleep 5

echo "=== Application Logs ==="
docker-compose -f docker-compose.dev.yml logs -f app