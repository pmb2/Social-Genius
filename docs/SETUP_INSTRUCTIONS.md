# Social Genius Setup Instructions

This document provides instructions for setting up the Social Genius application in both development and production environments, with a focus on Windows compatibility.

## Windows Setup

### Windows Batch Files

The following batch files have been created for Windows environments:

1. `start-dev.bat` - Starts the application in development mode
2. `start-prod.bat` - Starts the application in production mode 
3. `start-custom.bat` - Starts the application with custom domain configuration
4. `stop.bat` - Stops all running containers

### PowerShell Scripts

For more advanced features, PowerShell scripts are available:

1. `start-custom.ps1` - Advanced script with port conflict detection and resolution

## Custom Domain Configuration

The application has been configured to run with the custom domain `www.gbp.backus.agency`. This configuration involves:

1. Nginx as a reverse proxy
2. SSL certificate management with Certbot
3. Custom Docker Compose configuration

### Using Custom Domain Configuration

To use the custom domain configuration:

1. Run `start-custom.bat` or `start-custom.ps1`
2. The application will be available at:
   - HTTP: http://localhost:8082
   - HTTPS: https://localhost:448 (if SSL is configured)

## Docker Configuration

The custom Docker configuration includes:

1. Next.js application container (Node 18 Alpine)
2. PostgreSQL with pgvector for database
3. Redis for session management
4. Browser automation API service
5. Nginx for reverse proxy
6. Certbot for SSL certificate management

## Environment Variables

Important environment variables that need to be set:

- `NODE_ENV` - Environment (development/production)
- `NEXTAUTH_URL` - URL for NextAuth
- `NEXTAUTH_SECRET` - Secret for NextAuth
- `DATABASE_URL` - PostgreSQL connection string
- `BROWSER_USE_API_URL` - URL for browser automation API
- `REDIS_URL` - Redis connection string

## Troubleshooting

### Next.js "not found" Error

If you encounter a "next: not found" error, ensure that:

1. Node modules are properly installed
2. The start command includes `npm install` before running Next.js

### Port Conflicts

If you encounter port conflicts:

1. Use `start-custom.ps1` which has automatic port conflict detection
2. Use the alternative ports provided in the configuration:
   - HTTP: 8082 instead of 80
   - HTTPS: 448 instead of 443

### Next.js Configuration Warnings

If you see warnings about `appDir` in next.config.mjs:

This is a known issue with the latest version of Next.js. The configuration will still work but may show warnings about unrecognized keys.

### Database Initialization

If you're seeing 404 errors:

1. Make sure to initialize the database
2. Check if the authentication system is working properly

## Browser Automation API

The application uses a browser automation API for certain features. This service:

1. Runs in a separate container
2. Handles browser automation tasks
3. Stores screenshots in a dedicated volume
4. Uses Redis for session management

## Development Workflow

1. Make changes to the code
2. Run `start-custom.bat` or use `docker-compose -f docker-compose.custom.yml up -d`
3. The application will automatically rebuild with your changes

## Production Deployment

For production deployment:

1. Ensure your domain is properly configured
2. Set up SSL certificates using Certbot
3. Configure environment variables for production
4. Run `start-prod.bat` or use `docker-compose -f docker-compose.prod.yml up -d`