#!/bin/bash

# This script sets up HTTPS on the production server
# It assumes you can SSH to the server with the given credentials

SERVER_IP="138.197.95.73"
SSH_USER="root" 
DOMAIN="social-genius.com"  # Replace with your actual domain name

# Create the HTTPS setup script to run on the server
cat > setup-https.sh << 'EOF'
#!/bin/bash

DOMAIN="social-genius.com"  # Replace with your actual domain name
EMAIL="admin@example.com"   # Replace with your email

# Install Certbot if needed
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot
fi

# Create nginx configuration directory
mkdir -p /etc/nginx/conf.d

# Create a temporary nginx configuration file
cat > /etc/nginx/conf.d/app.conf << NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};
    
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

# Create directories for Certbot
mkdir -p /var/www/certbot

# Start Nginx in a container
docker run --name nginx-temp -p 80:80 -p 443:443 \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d \
  -v /var/www/certbot:/var/www/certbot \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -d nginx:alpine

# Wait for Nginx to start
sleep 5

# Obtain the SSL certificate
certbot certonly --webroot -w /var/www/certbot \
  -d ${DOMAIN} -d www.${DOMAIN} \
  --email ${EMAIL} --agree-tos --no-eff-email

# Stop the temporary Nginx container
docker stop nginx-temp
docker rm nginx-temp

# Create a docker-compose file with Nginx configuration
cat > docker-compose.yml << DOCKER
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/nginx/conf.d:/etc/nginx/conf.d
      - /etc/letsencrypt:/etc/letsencrypt
      - /var/www/certbot:/var/www/certbot
    restart: unless-stopped
    depends_on:
      - app

  app:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
      - NEXTAUTH_URL=https://${DOMAIN}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-your-secure-nextauth-secret}
    command: sh -c "npm install && npm run build && npm start"
    depends_on:
      - postgres
    restart: unless-stopped

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
DOCKER

# Update .env file
cat > .env << ENV
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
DATABASE_URL_DOCKER=postgresql://postgres:postgres@postgres:5432/socialgenius

# NextAuth Configuration
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-your-secure-nextauth-secret}
ENV

# Set up a cron job to renew the certificate
(crontab -l 2>/dev/null; echo "0 12 * * * certbot renew --post-hook 'docker exec nginx-certbot nginx -s reload'") | crontab -

# Start the application
docker-compose up -d

echo "HTTPS setup completed successfully!"
EOF

# Copy the setup script to the server
echo "Copying HTTPS setup script to server..."
scp setup-https.sh ${SSH_USER}@${SERVER_IP}:/root/setup-https.sh

# Execute the script on the server
echo "Executing HTTPS setup script on server..."
ssh ${SSH_USER}@${SERVER_IP} "chmod +x /root/setup-https.sh && /root/setup-https.sh"

echo "HTTPS setup has been applied to the production server!"