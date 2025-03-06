#!/bin/bash

# This script fixes the production server directly
# It assumes you can SSH to the server with the given credentials

SERVER_IP="138.197.95.73"
SSH_USER="root"

# Create the fix script to run on the server
cat > fix-server.sh << 'EOF'
#!/bin/bash

# Stop all containers
echo "Stopping all containers..."
docker-compose down || true
docker stop $(docker ps -aq) || true

# Initialize the database (minimal approach)
echo "Creating init-db.sql script..."
mkdir -p /tmp/init
cat > /tmp/init/init-db.sql << 'DBSQL'
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  business_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'noncompliant',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS sessions_id_idx ON sessions(session_id);
CREATE INDEX IF NOT EXISTS businesses_user_id_idx ON businesses(user_id);
DBSQL

# Run a temporary PostgreSQL container to initialize the database
echo "Starting temporary PostgreSQL container..."
docker run --name temp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=socialgenius -v /tmp/init:/docker-entrypoint-initdb.d -d pgvector/pgvector:pg14

# Wait for PostgreSQL to initialize
echo "Waiting for PostgreSQL to initialize..."
sleep 10

# Copy the database files to a volume
echo "Creating database volume..."
docker volume create postgres_data
docker run --rm -v postgres_data:/target -v $(docker inspect --format '{{.GraphDriver.Data.UpperDir}}' temp-postgres):/source alpine cp -r /source/var/lib/postgresql/data /target/

# Clean up
echo "Cleaning up..."
docker stop temp-postgres
docker rm temp-postgres
rm -rf /tmp/init

# Update the environment file to use proper Docker connection string
echo "Updating environment file..."
if [ -f .env ]; then
  # Backup the original file
  cp .env .env.bak
  
  # Update DATABASE_URL to use postgres container
  sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius|g' .env
  
  # Add Docker URL if it doesn't exist
  if ! grep -q "DATABASE_URL_DOCKER" .env; then
    echo "# For Docker setup (when app is running inside Docker container)" >> .env
    echo "DATABASE_URL_DOCKER=postgresql://postgres:postgres@postgres:5432/socialgenius" >> .env
  fi
else
  # Create a new .env file
  cat > .env << 'ENVFILE'
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
DATABASE_URL_DOCKER=postgresql://postgres:postgres@postgres:5432/socialgenius

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=social-genius-auth-secret-key-replace-in-production
ENVFILE
fi

# Create a simple docker-compose file if it doesn't exist
if [ ! -f docker-compose.yml ]; then
  cat > docker-compose.yml << 'DOCKER'
version: '3.8'
services:
  # Frontend and API application
  app:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
    command: sh -c "npm install && npm run build && npm start"
    depends_on:
      - postgres
    restart: unless-stopped

  # PostgreSQL database
  postgres:
    image: pgvector/pgvector:pg14
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: socialgenius
    restart: unless-stopped

volumes:
  postgres_data:
    external: true
DOCKER
fi

# Copy favicon to app directory
if [ -d app ]; then
  mkdir -p app/
  cp -f public/favicon.ico app/ 2>/dev/null || echo "Favicon copy failed - not critical"
fi

# Start the containers
echo "Starting containers..."
docker-compose up -d

echo "Fix applied successfully!"
EOF

# Copy the fix script to the server
echo "Copying fix script to server..."
scp fix-server.sh ${SSH_USER}@${SERVER_IP}:/root/fix-server.sh

# Execute the fix script on the server
echo "Executing fix script on server..."
ssh ${SSH_USER}@${SERVER_IP} "chmod +x /root/fix-server.sh && /root/fix-server.sh"

echo "Production server fix has been applied!"