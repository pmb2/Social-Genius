#!/bin/bash

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}Starting 502 fix for Social Genius...${NC}"

# Stop all running containers
echo -e "${YELLOW}Stopping all containers...${NC}"
docker-compose down
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose-fix.yml down

# Remove all containers that might be in the way
echo -e "${YELLOW}Cleaning up any stray containers...${NC}"
docker ps -a | grep -E "social-genius|nginx" | awk '{print $1}' | xargs -r docker rm -f

# Create the plain server if it doesn't exist
if [ ! -f plain-server.js ]; then
  echo -e "${YELLOW}Creating plain server file...${NC}"
  cat > plain-server.js << 'EOL'
// Simple HTTP server for Next.js
const http = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
// Always bind to 0.0.0.0 to ensure external accessibility
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server with binding to ${hostname}:${port}, NODE_ENV=${process.env.NODE_ENV}`);
console.log(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL}, GOOGLE_REDIRECT_URI=${process.env.GOOGLE_REDIRECT_URI}`);

// Initialize Next.js
const app = next({ dev, dir: '.' });
const handle = app.getRequestHandler();

// Prepare the Next.js application
app.prepare()
  .then(() => {
    // Create a simple HTTP server
    http.createServer((req, res) => {
      // Handle health check endpoints directly
      if (req.url === '/health' || req.url === '/api/health') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('OK');
        return;
      }
      
      // For all other requests, use Next.js request handler
      return handle(req, res);
    }).listen(port, hostname, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Access via http://localhost:${port}`);
      console.log(`> Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((ex) => {
    console.error('An error occurred starting the server:');
    console.error(ex.stack);
    process.exit(1);
  });
EOL
  echo -e "${GREEN}Plain server file created!${NC}"
fi

# Create simplified nginx config
if [ ! -f src/nginx/conf/simple.conf ]; then
  echo -e "${YELLOW}Creating simplified nginx config...${NC}"
  mkdir -p src/nginx/conf
  cat > src/nginx/conf/simple.conf << 'EOL'
server {
    listen 80;
    server_name _;
    
    # For AWS health checks
    location /health {
        access_log off;
        error_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
    
    # Forward all traffic to app
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Larger buffer for more stable transfers
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Increased timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOL
  echo -e "${GREEN}Simplified nginx config created!${NC}"
fi

# Create Dockerfile with plain server
echo -e "${YELLOW}Creating production Dockerfile with plain server...${NC}"
cat > Dockerfile.fix << 'EOL'
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
RUN npm install express google-auth-library --save

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment variables
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Build Next.js application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/plain-server.js ./

# Expose port
EXPOSE 3000

# Start with plain server for maximum reliability
CMD ["node", "plain-server.js"]
EOL

echo -e "${GREEN}Dockerfile.fix created!${NC}"

# Set environment variables for production
echo -e "${YELLOW}Setting up environment variables...${NC}"
export NEXTAUTH_URL=https://app.social-genius.com
export GOOGLE_REDIRECT_URI=https://app.social-genius.com/api/google-auth/callback

echo -e "${YELLOW}Building and starting containers with fix configuration...${NC}"
docker-compose -f docker-compose-fix.yml build
docker-compose -f docker-compose-fix.yml up -d

echo -e "${GREEN}Fix complete! Containers started with new configuration.${NC}"
echo -e "${YELLOW}Checking container status...${NC}"
docker ps -a

echo -e "${YELLOW}Checking nginx logs...${NC}"
sleep 5
docker-compose -f docker-compose-fix.yml logs nginx

echo -e "${YELLOW}Checking app logs...${NC}"
docker-compose -f docker-compose-fix.yml logs app

echo -e "${GREEN}Done!${NC}"
echo -e "${YELLOW}Site should now be accessible at app.social-genius.com${NC}"
echo -e "${YELLOW}If the site is still not accessible, try running:${NC}"
echo -e "${YELLOW}curl localhost${NC}"
echo -e "${YELLOW}to see if it responds, then check the AWS Load Balancer settings${NC}"