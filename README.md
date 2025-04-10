# Social Genius

Social Genius is an innovative web application designed to help businesses optimize and maintain their social media presence with minimal effort. By leveraging AI-powered content generation, competitor research, and compliance checking, the tool ensures businesses stay relevant to customers and improve brand engagement. Utilizing advanced AI-driven content generation and seamless scheduling, Social Genius provides a streamlined, compliant, and user-friendly solution for managing business social media presence.

## PostgreSQL Connection Fix for Docker

**IMPORTANT**: If you encounter PostgreSQL connection issues in Docker (errors like "this.Client is not a constructor" or "Class constructor Pool cannot be invoked without 'new'"), use our fix script:

```bash
./pg-fix-files/fix-docker.sh
```

This script:
1. Applies patches to fix PostgreSQL module issues
2. Sets up proper Docker network communication 
3. Ensures constructor safety for database connections
4. Starts all containers with the fixes applied

## Browser Automation

This project uses a dockerized browser-use-api service for reliable Google authentication with captcha handling. The service is included in the docker-compose configuration and runs alongside the main application.

### Browser-Use API Features

- Google authentication automation with bot-detection avoidance
- Captcha handling capabilities
- Asynchronous task processing
- Task status tracking
- Screenshot capture for debugging

## Table of Contents

- [Key Features](#key-features)
- [Subscription Plans](#subscription-plans)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Available Services](#available-services)
- [Development Notes](#development-notes)
- [Deployment Guide](#deployment-guide)
- [Payment Integration](#payment-integration)

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
- Browser-use API for Google authentication (included in Docker setup)

### Starting the Development Environment

#### On macOS:

```bash
# Standard development environment startup
./start-dev.sh

# If you encounter PostgreSQL connection issues, use our fix:
./pg-fix-files/fix-docker.sh

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
- PostgreSQL: localhost:5432 (username: postgres, password: postgres)
- Browser-use API: http://localhost:5055 (for browser automation with captcha handling)

### Browser-use API Service

The development environment includes a browser-use-api service that:

1. Handles Google authentication with captcha solving
2. Provides an API for browser automation tasks
3. Saves screenshots of the authentication process for debugging
4. Works asynchronously using a task-based approach

Access the Browser-use API documentation at http://localhost:5055/docs when the service is running.

## Development Notes

- Use the module-manifest.json file to keep track of components and their dependencies
- Run the check-missing-modules.js script to identify missing modules and packages
- Always restart the app container after making changes to the manifest

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

## Subscription Plans

Social Genius offers flexible subscription plans to accommodate businesses of all sizes:

1. **Basic Plan** - $199/month
   - For businesses managing 1-10 locations
   - 4 AI-generated posts per month
   - Up to 100 review responses per month
   - 2 team member accounts

2. **Professional Plan** - $169/month
   - For businesses managing 11-50 locations
   - 8 AI-generated posts per month
   - Up to 500 review responses per month
   - 5 team member accounts
   - White-label reports
   - Basic competitor analysis

3. **Business Plan** - $119/month
   - For businesses managing 51-250 locations
   - 12 AI-generated posts per month
   - Unlimited review responses
   - Unlimited team members
   - Advanced competitor analysis
   - Dedicated account manager

4. **Enterprise Plan** - Custom pricing
   - For businesses managing 251+ locations
   - Custom posting schedule
   - All premium features
   - Custom integrations
   - API access
   - Enterprise-level support

All plans include discounted annual billing options. See the [subscription documentation](docs/PAYMENT_INTEGRATION.md) for more details.

## Payment Integration

Social Genius uses Helcim as its payment processor for handling subscriptions and payments. Helcim was selected for the following key advantages:

1. **Cost-Effective Pricing**: Helcim's interchange-plus pricing model offers lower transaction fees compared to flat-rate processors like Stripe, especially for high-volume businesses.

2. **Streamlined Ownership Transfer**: The API-based ownership transfer process reduces delays and manual interventions during subscription changes or account transfers.

3. **Multi-Currency Support**: Built-in support for international payments makes it ideal for scaling globally.

4. **Proactive Fraud Monitoring**: Sophisticated fraud detection minimizes account freezes or service disruptions.

### Implementation Details

- Payment processing is handled through the `/api/payments/` endpoints
- Subscription management is available in the user dashboard
- Secure card tokenization prevents sensitive data from touching our servers
- Webhook integration ensures subscription events are properly processed

For complete implementation details, see the [payment integration documentation](docs/PAYMENT_INTEGRATION.md).