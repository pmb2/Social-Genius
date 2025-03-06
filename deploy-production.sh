#!/bin/bash

# This script deploys the application to a production server
# It assumes you have SSH access to a server with Docker installed

# Set variables
SERVER_IP="138.197.95.73"
SSH_USER="root"
DOMAIN="social-genius.com"  # Replace with your actual domain

# Update environment variables for production
cat > .env.production << EOF
# Base URLs and API Keys
OPENAI_API_KEY=${OPENAI_API_KEY:-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}

# PostgreSQL Database Configuration
# Production database connects to the PostgreSQL container
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius

# NextAuth Configuration
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-social-genius-auth-secret-key-replace-in-production}

# External API Keys
EXA_API_KEY=${EXA_API_KEY:-f5c132ea-a9ae-4977-a59b-f79ee13ea44f}
GROQ_API_KEY=${GROQ_API_KEY:-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}

# Next.js client-side environment variables
NEXT_PUBLIC_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
NEXT_PUBLIC_EXA_API_KEY=${EXA_API_KEY:-f5c132ea-a9ae-4977-a59b-f79ee13ea44f}
NEXT_PUBLIC_GROQ_API_KEY=${GROQ_API_KEY:-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}
NEXT_PUBLIC_OPENAI_API_KEY=${OPENAI_API_KEY:-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}
EOF

# Create the nginx configuration file for production
mkdir -p nginx/prod
cat > nginx/prod/default.conf << EOF
server {
    listen 80;
    server_name _;

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name _;

    # SSL certificates (self-signed for now)
    ssl_certificate /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # Add HSTS header for better security
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Proxy to the Next.js application
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Create a docker-compose file for production
cat > docker-compose.production.yml << EOF
version: '3.8'
services:
  # Nginx for SSL termination and reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - social_genius_network

  # Frontend and API application
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
      - NEXTAUTH_URL=https://${DOMAIN}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-social-genius-auth-secret-key-replace-in-production}
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - social_genius_network

  # PostgreSQL with pgvector
  postgres:
    image: pgvector/pgvector:pg14
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: socialgenius
    restart: unless-stopped
    networks:
      - social_genius_network

networks:
  social_genius_network:
    driver: bridge

volumes:
  postgres_data:
EOF

# Create init-db.sql for automatic database initialization
mkdir -p scripts
cat > scripts/init-db.sql << EOF
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
EOF

# Create SSL directory and generate self-signed certificate
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/server.key \
  -out nginx/ssl/server.crt \
  -subj "/CN=${DOMAIN}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:www.${DOMAIN}"

# Build the production Docker image
docker build -t social-genius-prod -f Dockerfile.prod .

# Save the Docker image to a tar file
docker save social-genius-prod | gzip > social-genius-prod.tar.gz

# Copy files to the production server
scp -r docker-compose.production.yml nginx scripts .env.production social-genius-prod.tar.gz ${SSH_USER}@${SERVER_IP}:/root/social-genius

# Connect to the server and deploy
ssh ${SSH_USER}@${SERVER_IP} << 'ENDSSH'
cd /root/social-genius

# Load the Docker image
docker load < social-genius-prod.tar.gz

# Rename .env.production to .env
mv .env.production .env

# Start the application
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# Clean up
rm social-genius-prod.tar.gz

echo "Deployment complete!"
ENDSSH