#!/bin/bash

# Start the database first
echo "Starting PostgreSQL database..."
docker-compose up -d postgres

# Wait for the database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Install dotenv and pg if needed
if ! npm list dotenv pg &>/dev/null; then
  echo "Installing required dependencies..."
  npm install dotenv pg --no-save
fi

# Verify database connections and initialize tables
echo "Verifying database..."
node verify-db.js

# Update favicon and ensure it's available
echo "Ensuring favicon is correctly set up..."
cp -f public/favicon.ico app/

# Start the application
echo "Starting application in development mode..."
npm run dev