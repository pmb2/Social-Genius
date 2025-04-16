# Social Genius

Social Genius is an innovative web application designed to help businesses optimize and maintain their social media presence with minimal effort. By leveraging AI-powered content generation, competitor research, and compliance checking, the tool ensures businesses stay relevant to customers and improve brand engagement. Utilizing advanced AI-driven content generation and seamless scheduling, Social Genius provides a streamlined, compliant, and user-friendly solution for managing business social media presence.

## Table of Contents

- [Key Features](#key-features)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Available Services](#available-services)
- [Development Notes](#development-notes)
- [Troubleshooting](#troubleshooting)
- [Deployment Guide](#deployment-guide)

## Key Features

1. Automated Weekly Photo Uploads
   - Uploads a new photo each week to keep the profile fresh and visually engaging.
2. AI-Generated Weekly Posts
   - Creates and posts content tailored to the business's branding, including promotions, announcements, or educational posts.
3. Monthly Q&A Updates
   - Generates frequently asked questions and answers relevant to the business, improving customer interaction.
4. Timely Review Management
   - Responds to customer reviews within 72 hours using AI-generated replies, ensuring positive engagement.
5. All-in-One Dashboard
   - A centralized hub for managing multiple businesses on one page, providing efficiency and ease of use for agency owners.
6. Hands-Off Email System
   - An integrated, fully autonomous email system that keeps users informed about their activities and platform updates.
7. Custom Branding & Compliance
   - Maintains the business's tone and style while adhering to compliance requirements.
8. Multi-Business Support
   - Allows agencies or consultants to manage multiple business profiles from one account.

## Development Environment Setup

### Prerequisites

- Docker and Docker Compose
- Node.js and npm (for local development)

### Starting the Development Environment

#### On macOS:

```bash
# Start the development environment
./start-dev.sh

# To stop all containers
docker-compose -f docker-compose.dev.yml down
```

#### On Windows:

```bash
# Start the development environment
start-dev.bat

# To stop all containers
stop.bat
```

### Adding Missing Dependencies

If you encounter any missing modules, you can run:

```bash
# This will install all required dependencies from module-manifest.json
./scripts/install-deps.sh
```

## Project Structure

- `/app` - Next.js pages and routes
- `/components` - React components
- `/lib` - Shared utilities and libraries
- `/services` - Backend services
- `/api` - API routes
- `/public` - Static files
- `/docs` - Documentation

## Available Services

- Web App: http://localhost:3001
- pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)
- PostgreSQL: localhost:5435 (username: postgres, password: postgres)

## Development Notes

- Use the module-manifest.json file to keep track of components and their dependencies
- Run the check-missing-modules.js script to identify missing modules and packages
- Always restart the app container after making changes to the manifest

## Troubleshooting

### Database Issues

If you encounter database-related errors, such as:
- "column 'document_id' referenced in foreign key constraint does not exist"
- "column 'updated_at' of relation 'users' does not exist"
- Connection issues with the PostgreSQL database
- Authentication failures due to database schema problems

Use the provided fix scripts:

```bash
# Fix database schema issues
./fix-db-schema.sh

# Fix the users table updated_at column issue (for registration errors)
./fix-users-table.sh

# Apply all fixes including DB connection and schema issues
./fix-all.sh

# Make sure all scripts are executable
./make-scripts-executable.sh
```

For more detailed information about the database fixes, see:
- [DATABASE_FIX_README.md](./DATABASE_FIX_README.md) - Comprehensive documentation on database fixes
- [POSTGRES_MANAGEMENT.md](./docs/POSTGRES_MANAGEMENT.md) - General PostgreSQL management guidance
- [PGVECTOR_INTEGRATION.md](./docs/PGVECTOR_INTEGRATION.md) - Information on the vector database integration

### Console Noise Reduction

To reduce development console noise (especially [Fast Refresh] messages), use:

```bash
# Start development with reduced console noise
./start-dev-quiet.sh
```

## Deployment Guide

### Development Environment
1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Visit `http://localhost:3000` to view the application

### Production Deployment with HTTPS
To deploy the application in a production environment with HTTPS:

1. Make sure Docker and Docker Compose are installed on your server
2. Clone the repository to your server
3. Configure your domain name to point to your server's IP address
4. Run the SSL setup script: `./init-ssl.sh yourdomain.com`
5. Start the application in production mode: `./start-prod-secure.sh`
6. Access your application securely at `https://yourdomain.com`

This setup provides:
- Secure HTTPS connections using Let's Encrypt SSL certificates
- Automatic renewal of SSL certificates
- PostgreSQL database in a Docker container
- Next.js application running in production mode
- Nginx as a reverse proxy with proper security headers