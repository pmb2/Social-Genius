#!/bin/bash

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Starting 502 fix v2 for Social Genius...${NC}"

# Stop all running containers
echo -e "${YELLOW}Stopping all containers...${NC}"
docker-compose down --remove-orphans
docker-compose -f docker-compose.dev.yml down --remove-orphans
docker-compose -f docker-compose-fix.yml down --remove-orphans

# Kill any process using port 80 or 3000
echo -e "${YELLOW}Checking for processes using ports 80 and 3000...${NC}"
sudo lsof -i :80 | grep -v PID | awk '{print $2}' | xargs -r sudo kill -9
sudo lsof -i :3000 | grep -v PID | awk '{print $2}' | xargs -r sudo kill -9

# Clean up containers
echo -e "${YELLOW}Cleaning up any stray containers...${NC}"
docker ps -a | grep -E "social-genius|nginx" | awk '{print $1}' | xargs -r docker rm -f

# Fix the syntax error in init-oauth-db/route.ts
echo -e "${YELLOW}Fixing syntax error in init-oauth-db/route.ts...${NC}"
if [ -f src/app/api/init-oauth-db/route.ts ]; then
  # Replace backslash exclamation mark with just exclamation mark
  sed -i 's/\\!/!/g' src/app/api/init-oauth-db/route.ts
  echo -e "${GREEN}Fixed syntax error in route.ts${NC}"
else
  echo -e "${YELLOW}init-oauth-db/route.ts file not found, skipping syntax fix${NC}"
fi

# Create a simpler server file that just serves Next.js
echo -e "${YELLOW}Creating simplified server file...${NC}"
cat > server.js << 'EOL'
// Simple HTTP server for Next.js
const http = require('http');
const { createReadStream } = require('fs');
const { join } = require('path');

// Always bind to 0.0.0.0 to ensure external accessibility
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting simple server on port ${port}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Static HTML for health checks
const healthHtml = 'OK';

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  // Log all requests except health checks
  if (req.url !== '/health' && req.url !== '/api/health') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }

  // Simple router
  if (req.url === '/health' || req.url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(healthHtml);
    return;
  }

  // For all other routes, serve the placeholder
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Social Genius - Maintenance</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #333; }
          .message { margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Social Genius</h1>
          <div class="message">
            <h2>Site Maintenance</h2>
            <p>We're performing scheduled maintenance. We'll be back shortly!</p>
            <p>Server is responding correctly - this is a temporary maintenance page.</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Start the server on all interfaces (0.0.0.0)
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});

// Handle errors
server.on('error', (e) => {
  console.error('Server error:', e);
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use!`);
  }
});
EOL

echo -e "${GREEN}Created simplified server file${NC}"

# Create a simple Dockerfile that just serves a maintenance page
echo -e "${YELLOW}Creating minimal Dockerfile...${NC}"
cat > Dockerfile.minimal << 'EOL'
FROM node:18-alpine

WORKDIR /app

# Copy only what we need for the simple server
COPY server.js ./

ENV NODE_ENV production
ENV PORT 3000

EXPOSE 3000

# Start the simple server
CMD ["node", "server.js"]
EOL

echo -e "${GREEN}Created minimal Dockerfile${NC}"

# Create simple docker-compose file
echo -e "${YELLOW}Creating minimal Docker Compose file...${NC}"
cat > docker-compose.minimal.yml << 'EOL'
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"  # Use port 8080 instead of 80 to avoid conflicts
    volumes:
      - ./src/nginx/conf/simple.conf:/etc/nginx/conf.d/default.conf
    restart: unless-stopped
    depends_on:
      - app
    networks:
      - sg_network

  app:
    build:
      context: .
      dockerfile: Dockerfile.minimal
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    restart: unless-stopped
    networks:
      - sg_network

networks:
  sg_network:
    driver: bridge
EOL

echo -e "${GREEN}Created minimal docker-compose file${NC}"

# Create simplified nginx config
echo -e "${YELLOW}Creating minimal nginx config...${NC}"
mkdir -p src/nginx/conf
cat > src/nginx/conf/simple.conf << 'EOL'
server {
    listen 80;
    server_name _;
    
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # For health checks
    location /health {
        access_log off;
        error_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
    
    # Forward traffic to app
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increased timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOL

echo -e "${GREEN}Created simplified nginx config${NC}"

# Build and start the minimal setup
echo -e "${YELLOW}Building and starting minimal containers...${NC}"
docker-compose -f docker-compose.minimal.yml build --no-cache
docker-compose -f docker-compose.minimal.yml up -d

echo -e "${YELLOW}Checking container status...${NC}"
docker ps

echo -e "${YELLOW}Checking app logs...${NC}"
docker-compose -f docker-compose.minimal.yml logs app

echo -e "${YELLOW}Checking nginx logs...${NC}"
docker-compose -f docker-compose.minimal.yml logs nginx

echo -e "${GREEN}Maintenance mode setup complete!${NC}"
echo -e "${YELLOW}Site should now be accessible with a maintenance page at:${NC}"
echo -e "${YELLOW}http://app.social-genius.com/ (if DNS points to this server)${NC}"
echo -e "${YELLOW}http://localhost:8080/ (locally)${NC}"
echo
echo -e "${YELLOW}To verify the server works:${NC}"
echo -e "${YELLOW}curl localhost:8080${NC}"
echo -e "${YELLOW}curl localhost:8080/health${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Verify the maintenance page is accessible"
echo -e "2. Fix the build errors in your Next.js app"
echo -e "3. Once fixed, run your regular deployment process"