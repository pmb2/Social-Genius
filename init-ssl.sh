#!/bin/bash

# This script sets up SSL certificates for the Social Genius application
# It requires that you have a domain name pointing to your server

# Check if domain is provided
if [ -z "$1" ]; then
  echo "Please provide a domain name as an argument"
  echo "Usage: $0 yourdomain.com"
  exit 1
fi

DOMAIN=$1

# Create necessary directories
mkdir -p ./nginx/certbot/conf
mkdir -p ./nginx/certbot/www

# Create a temporary nginx config for initial certificate generation
cat > ./nginx/conf/app.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;
    
    # Self-signed certificates for initial setup
    ssl_certificate /etc/nginx/conf.d/dummy.crt;
    ssl_certificate_key /etc/nginx/conf.d/dummy.key;
    
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Generate dummy self-signed certificate
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
  -keyout ./nginx/conf/dummy.key \
  -out ./nginx/conf/dummy.crt \
  -subj "/CN=$DOMAIN"

# Start nginx container
docker-compose -f docker-compose.prod.yml up -d nginx

# Wait for nginx to start
sleep 5

# Obtain real certificates using certbot
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email admin@$DOMAIN --agree-tos --no-eff-email \
  -d $DOMAIN

# Update nginx config with real certificates
cat > ./nginx/conf/app.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # For Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # Proxy to Next.js app
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

# Restart nginx to apply the new configuration
docker-compose -f docker-compose.prod.yml restart nginx

# Start the full application stack
docker-compose -f docker-compose.prod.yml up -d

echo "SSL setup complete for $DOMAIN"
echo "Your application is now running with HTTPS"