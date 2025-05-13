# Social Genius Production Deployment Guide

This guide provides comprehensive instructions for deploying the Social Genius application to production, making it accessible at `www.app.social-genius.com` using AWS services.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [EC2 Static IP Configuration](#ec2-static-ip-configuration)
3. [Domain Configuration with Route 53](#domain-configuration-with-route-53)
4. [Application Configuration for Production](#application-configuration-for-production)
5. [Docker Container Setup](#docker-container-setup)
6. [HTTPS/SSL Configuration](#httpsssl-configuration)
7. [Testing and Verification](#testing-and-verification)
8. [Alternative Home Deployment Setup](#alternative-home-deployment-setup)

## Architecture Overview

The production architecture consists of:
- Docker containers running the Social Genius application
- AWS EC2 instance hosting the containers
- AWS Route 53 for DNS management
- AWS Elastic IP for static IP addressing
- AWS Certificate Manager for SSL/TLS

## EC2 Static IP Configuration

To assign a static IP (Elastic IP) to your EC2 instance:

1. **Allocate an Elastic IP**:
   - Open AWS Console and navigate to EC2 → Elastic IPs
   - Click "Allocate Elastic IP address"
   - Select "Amazon's pool of IPv4 addresses" and click "Allocate"

2. **Associate the Elastic IP with your EC2 instance**:
   - Select the newly allocated Elastic IP
   - Click "Actions" → "Associate Elastic IP address"
   - Select your EC2 instance from the dropdown
   - Click "Associate"

3. **Verify the association**:
   - The EC2 instance details should now show the Elastic IP address
   - You can now stop and start your instance without the public IP changing

4. **Configure security groups**:
   - Ensure your EC2 security group allows inbound traffic on:
     - Port 80 (HTTP)
     - Port 443 (HTTPS)
     - Port 22 (SSH) - restrict to your IP address for security

**Important**: AWS charges for Elastic IPs that are not associated with running instances. To avoid charges, either keep your instance running or release the Elastic IP when your instance is stopped for extended periods.

## Domain Configuration with Route 53

1. **Create a record in Route 53**:
   - Open AWS Console and navigate to Route 53
   - Select your hosted zone for `social-genius.com`
   - Click "Create Record"
   - Set the record name to `www.app` (this will create `www.app.social-genius.com`)
   - Set record type to "A - IPv4 address"
   - Enter your Elastic IP address in the "Value" field
   - Keep "TTL" at default or reduce to 300 seconds during initial setup
   - Save the record

2. **Verify DNS propagation**:
   - Use a tool like `dig` or online DNS checkers to verify:
   ```
   dig www.app.social-genius.com
   ```
   - DNS changes can take up to 48 hours to propagate, but often happen within minutes to hours

## Application Configuration for Production

### Environment Variables

Update your `.env` file with production configuration:

```bash
# Base URL for the application
NEXTAUTH_URL=https://www.app.social-genius.com
BASE_URL=https://www.app.social-genius.com

# Google Business Profile API Configuration
GOOGLE_REDIRECT_URI=https://www.app.social-genius.com/api/google-auth/callback

# Generate a secure GOOGLE_TOKEN_ENCRYPTION_KEY
GOOGLE_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Set this to false once you've confirmed API access works
GOOGLE_API_USE_FALLBACK=false
```

### Next.js Configuration

Update `next.config.mjs` to handle the production domain:

```javascript
const nextConfig = {
  // Existing configuration...
  
  // Add production domain to image sources if needed
  images: {
    domains: [
      // ... existing domains
      'www.app.social-genius.com',
      'app.social-genius.com',
    ],
  },
  
  // Configure headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};
```

### Middleware Configuration

Ensure our middleware correctly handles the production domain by updating `middleware.ts`:

```typescript
export const config = {
  matcher: [
    // Add your matchers here...
  ],
};

export default function middleware(request: NextRequest) {
  // Existing middleware code...
  
  // If you need to handle domain-specific logic:
  const hostname = request.headers.get('host');
  const isProductionDomain = hostname === 'www.app.social-genius.com' || 
                            hostname === 'app.social-genius.com';
  
  // Add any domain-specific handling if needed
  
  return NextResponse.next();
}
```

## Docker Container Setup

### Update Docker Compose

Modify `docker-compose.yml` to support production deployment:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: always
    ports:
      - "80:3000"
      - "443:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
    depends_on:
      - postgres
      - redis
    volumes:
      - ./public/uploads:/app/public/uploads
      - ./ssl:/app/ssl
    networks:
      - app-network

  postgres:
    image: postgres:14
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=socialgenius
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker-entrypoint-initdb.d:/docker-entrypoint-initdb.d
    networks:
      - app-network

  redis:
    image: redis:6
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redis}
    volumes:
      - redis-data:/data
    networks:
      - app-network

  nginx:
    image: nginx:1.21
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf:/etc/nginx/conf.d
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    depends_on:
      - app
    networks:
      - app-network

  certbot:
    image: certbot/certbot
    volumes:
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### Nginx Configuration

Create an Nginx configuration for SSL termination and proxy pass:

1. Create the directory structure:
```bash
mkdir -p nginx/conf
mkdir -p nginx/certbot/conf
mkdir -p nginx/certbot/www
```

2. Create `nginx/conf/app.conf`:
```nginx
server {
    listen 80;
    server_name www.app.social-genius.com app.social-genius.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name www.app.social-genius.com app.social-genius.com;
    
    ssl_certificate /etc/letsencrypt/live/www.app.social-genius.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.app.social-genius.com/privkey.pem;
    
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Enable WebSocket support
    location /api/socket {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    
    # Set client_max_body_size to 10M
    client_max_body_size 10M;
}
```

## HTTPS/SSL Configuration

### Obtaining SSL Certificate with Let's Encrypt

1. **Initialize the SSL certificate**:

Create a script called `init-letsencrypt.sh` in your project root:

```bash
#!/bin/bash

domains=(www.app.social-genius.com app.social-genius.com)
email="your-email@example.com" # Replace with your email
staging=0 # Set to 1 for testing

if [ -d "$data_path" ]; then
  read -p "Existing data found for $domains. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

mkdir -p nginx/certbot/conf nginx/certbot/www

echo "### Creating dummy certificate for $domains ..."
path="/etc/letsencrypt/live/$domains"
mkdir -p nginx/certbot/conf/live/$domains
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:2048 -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx ..."
docker-compose up --force-recreate -d nginx

echo "### Deleting dummy certificate for $domains ..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot

echo "### Requesting Let's Encrypt certificate for $domains ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal" certbot

echo "### Reloading nginx ..."
docker-compose exec nginx nginx -s reload
```

2. **Make the script executable and run it**:
```bash
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh
```

This script will:
- Create a dummy certificate to bootstrap Nginx
- Start Nginx with the dummy certificate
- Request a proper SSL certificate from Let's Encrypt
- Update Nginx to use the proper certificate

## Testing and Verification

After completing the setup, verify the following:

1. **DNS Resolution**:
```bash
dig www.app.social-genius.com
```

2. **SSL Certificate**:
```bash
openssl s_client -connect www.app.social-genius.com:443 -servername www.app.social-genius.com
```

3. **Application Accessibility**:
   - Navigate to https://www.app.social-genius.com in your browser
   - Verify that the application loads without errors
   - Test login and core functionality

## Alternative Home Deployment Setup

If you decide to run the application from your home computer instead of EC2, follow these additional steps:

### Router Configuration

1. **Set up a Static IP**:
   - Access your router's admin panel
   - Configure a static internal IP for the computer running Docker
   - Typically found under "DHCP" or "LAN" settings

2. **Port Forwarding**:
   - Configure your router to forward ports 80 and 443 to your Docker host
   - Navigate to "Port Forwarding" or "Virtual Server" in your router settings
   - Forward external ports 80 and 443 to the internal IP of your Docker host

### Dynamic DNS (Optional)

If your home IP changes frequently:

1. **Sign up for a Dynamic DNS service** (like No-IP, DynDNS, or Duck DNS)
2. **Install their client** on your home computer
3. **Update Route 53 settings**:
   - Create a CNAME record for `www.app.social-genius.com` pointing to your Dynamic DNS hostname
   - Or use AWS Route 53's own dynamic DNS update capabilities

### Security Considerations for Home Deployment

1. **Update firewall settings** on your home computer to allow inbound traffic on ports 80/443
2. **Install and configure UFW (Uncomplicated Firewall)**:
```bash
sudo apt-get install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

3. **Consider using Cloudflare** as a proxy to:
   - Hide your home IP address
   - Provide additional DDoS protection
   - Offer free SSL certificates

## Maintaining Your Deployment

### Regular Updates

1. **Pull updates from your repository**:
```bash
git pull
```

2. **Rebuild and restart containers**:
```bash
docker-compose down
docker-compose up --build -d
```

### SSL Certificate Renewal

Let's Encrypt certificates expire after 90 days. The certbot container is configured to attempt renewal every 12 hours. To manually renew:

```bash
docker-compose run --rm certbot renew
docker-compose exec nginx nginx -s reload
```

### Database Backups

Set up a daily backup script for your PostgreSQL database:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/path/to/backups"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Run the backup
docker-compose exec postgres pg_dump -U postgres socialgenius > $BACKUP_DIR/backup_$DATE.sql

# Keep only the last 7 backups
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs rm -f
```

Make this executable and add it to your crontab:
```bash
chmod +x backup.sh
crontab -e
# Add: 0 0 * * * /path/to/backup.sh
```

## Conclusion

Following this guide will set up your Social Genius application to be accessible at www.app.social-genius.com with proper SSL/TLS encryption, whether deployed on AWS EC2 or from your home computer. Remember to regularly update your application and maintain your SSL certificates to ensure ongoing security and stability.