# Domain Setup for www.gbp.backus.agency

This document explains how to set up and deploy the Social Genius application to make it accessible at https://www.gbp.backus.agency.

## Prerequisites

1. A server with Docker and Docker Compose installed
2. Domain name `gbp.backus.agency` pointing to your server's IP address
3. Both `gbp.backus.agency` and `www.gbp.backus.agency` DNS records configured
4. Open ports 80 and 443 on your server's firewall

## Configuration Files

The following files have been set up for the domain deployment:

- `docker-compose.prod.yml` - Production Docker configuration
- `src/nginx/conf/app.conf` - Nginx configuration with domain settings
- `start-prod.sh` - Linux script for starting production deployment
- `start-prod.bat` - Windows script for starting production deployment

## DNS Configuration

Before deploying, ensure your DNS records are properly configured:

1. Create an A record for `gbp.backus.agency` pointing to your server's IP address
2. Create either an A record or CNAME record for `www.gbp.backus.agency`

```
Type    Name               Value
A       gbp.backus.agency  <Your Server IP>
A/CNAME www.gbp.backus.agency  <Your Server IP or gbp.backus.agency>
```

## SSL Certificates

SSL certificates are obtained automatically using Let's Encrypt when you run `start-prod.sh` on a Linux server. For Windows users, you have two options:

1. Run the deployment inside WSL (Windows Subsystem for Linux) using `start-prod.sh`
2. Manually obtain SSL certificates and place them in the `certbot/conf/live/www.gbp.backus.agency/` directory

## Deployment Steps

### On Linux/Mac:

1. Make the script executable:
   ```bash
   chmod +x start-prod.sh
   ```

2. Run the script:
   ```bash
   ./start-prod.sh
   ```

3. The script will:
   - Check for Docker
   - Create .env file if needed
   - Obtain SSL certificates if needed
   - Start all services
   - Provide access URL

### On Windows:

1. Run the script from Command Prompt or PowerShell:
   ```cmd
   start-prod.bat
   ```

2. If SSL certificates are not present, the script will provide instructions for either:
   - Running the Linux script in WSL
   - Manually placing SSL certificates in the appropriate directory

## Environment Variables

Make sure your `.env` file contains all necessary API keys and configuration values:

```
NEXTAUTH_SECRET=your-secure-nextauth-secret
OPENAI_API_KEY=your-openai-api-key
GROQ_API_KEY=your-groq-api-key
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
```

## Troubleshooting

If your deployment fails, check the following:

1. DNS records are properly configured and propagated
2. Ports 80 and 443 are open on your server
3. Docker and Docker Compose are properly installed
4. SSL certificate generation issues (check certbot logs)
5. Docker container logs: `docker-compose -f docker-compose.prod.yml logs`

## Maintenance

- To view logs: `docker-compose -f docker-compose.prod.yml logs -f`
- To restart services: `docker-compose -f docker-compose.prod.yml restart`
- To stop services: `docker-compose -f docker-compose.prod.yml down`
- To update and rebuild: Run the start script with the rebuild option