#!/bin/bash

# This script starts the Social Genius application in production mode with HTTPS

# Make sure Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Start the PostgreSQL database first to ensure it's ready
echo "Starting PostgreSQL database..."
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# Initialize the database if needed
echo "Initializing database..."
docker-compose -f docker-compose.prod.yml run --rm app node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDb() {
  const client = await pool.connect();
  try {
    // Create vector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create tables
    await client.query(\`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      )
    \`);
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    \`);
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        business_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'noncompliant',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, user_id)
      )
    \`);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    client.release();
    pool.end();
  }
}

initDb();
"

# Start the full application stack
echo "Starting the full application stack..."
docker-compose -f docker-compose.prod.yml up -d

echo "Social Genius is now running in production mode!"
echo "If you haven't set up HTTPS yet, run ./init-ssl.sh yourdomain.com"