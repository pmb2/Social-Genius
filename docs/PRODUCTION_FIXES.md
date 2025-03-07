# Production Server Fixes

This document provides instructions for fixing issues on the production server.

## Current Issues

1. **Database Connection Error**: The server is returning "Error checking user records" during registration.
2. **HTTP Security Warning**: Login forms are being served over HTTP, which is insecure.
3. **Favicon 500 Error**: The server returns a 500 error when requesting favicon.ico.

## Fix Scripts

We've created several scripts to address these issues:

### 1. Fix Database Issues

The `fix-production.sh` script will:
- Connect to the production server using SSH
- Stop any existing containers
- Create a properly initialized PostgreSQL database
- Update environment variables to use the correct database connection string
- Ensure the application has the correct configuration

To run:
```
./fix-production.sh
```

### 2. Setup HTTPS with SSL

The `setup-https.sh` script will:
- Install Certbot on the server
- Set up Nginx as a reverse proxy
- Obtain Let's Encrypt SSL certificates
- Configure the application to use HTTPS
- Set up automatic certificate renewal

To run:
```
./setup-https.sh
```

### 3. Direct Database Setup

If you just want to fix the database directly:
1. Upload the `setup-database.js` script to the server
2. Install dependencies: `npm install pg dotenv`
3. Run: `node setup-database.js`

This will create all the necessary database tables for authentication.

## Manual Fixes

If the scripts don't work, you can try these manual steps:

### Database Connection Issues

1. SSH to the server: `ssh root@138.197.95.73`
2. Check if PostgreSQL is running: `docker ps | grep postgres`
3. If not, start it: `docker-compose up -d postgres`
4. Check the database URL in `.env`: `cat .env | grep DATABASE_URL`
5. Update if needed: `sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius|g' .env`
6. Restart the application: `docker-compose restart app`

### HTTPS Setup

1. Install Certbot: `apt-get update && apt-get install -y certbot`
2. Get a certificate: `certbot certonly --standalone -d social-genius.com -d www.social-genius.com`
3. Configure Nginx as described in the `setup-https.sh` script
4. Update NEXTAUTH_URL to use HTTPS: `sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://social-genius.com|g' .env`

### Favicon Fix

1. Copy the favicon to the app directory: `cp public/favicon.ico app/`
2. Restart the application: `docker-compose restart app`

## Verifying the Fixes

After applying the fixes:

1. Navigate to the application in your browser (preferably using HTTPS)
2. Try to register a new user
3. Check if registration and login work correctly
4. Verify that you don't see HTTP security warnings
5. Check if the favicon loads correctly

## Troubleshooting

If issues persist:

1. Check Docker logs: `docker-compose logs app`
2. Check nginx logs: `docker-compose logs nginx`
3. Verify database connection: `docker exec -it <postgres-container-id> psql -U postgres -d socialgenius -c "\\dt"`
4. Check environment variables: `docker inspect <app-container-id> | grep -A20 "Env"`