# Social Genius

Social Genius is an innovative web application designed to help businesses optimize and maintain their social media presence with minimal effort. By leveraging AI-powered content generation, competitor research, and compliance checking, the tool ensures businesses stay relevant to customers and improve brand engagement.

## Table of Contents

- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Available Services](#available-services)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)

## Key Features

1. Automated Weekly Photo Uploads
2. AI-Generated Weekly Posts
3. Monthly Q&A Updates
4. Timely Review Management
5. All-in-One Dashboard
6. Hands-Off Email System
7. Custom Branding & Compliance
8. Multi-Business Support

## Project Structure

Our codebase follows a domain-driven organization:

```
/app                      # Next.js app router pages and API routes
  /(protected)            # Protected routes requiring authentication
  /api                    # API endpoints organized by feature
/src                      # Source code organized by domain
  /components             # React components
    /auth                 # Authentication components
    /business             # Business-related components
    /compliance           # Compliance features
    /layout               # Layout components
    /ui                   # Reusable UI components
  /lib                    # Utility functions and shared code
    /auth                 # Authentication utilities
    /utilities            # Common utilities
    /hooks                # React hooks
    /providers            # Context providers
  /services               # Backend services
    /api                  # External API clients
    /auth                 # Authentication services
    /database             # Database services
    /compliance           # Compliance services
/public                   # Static assets
/docs                     # Documentation
```

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js and npm (for local development)

### Starting the Development Environment

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start with suppressed logs
npm run dev:quiet

# Run linting
npm run lint

# Run compliance tests
npm run test:compliance
```

### Environment Variables

See `.env.example` for required environment variables.

## Available Services

- Web App: http://localhost:3001
- pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)
- PostgreSQL: localhost:5435 (username: postgres, password: postgres)

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- [API Documentation](src/docs/API_DOCUMENTATION.md)
- [Browser Automation Architecture](src/docs/BROWSER_AUTOMATION_ARCHITECTURE.md)
- [Google Auth Flow](src/docs/GOOGLE_AUTH_FLOW.md)
- [Google OAuth Setup](src/docs/GOOGLE_OAUTH_SETUP.md) - **NEW: Guide for setting up Google OAuth**
- [PostgreSQL Management](src/docs/POSTGRES_MANAGEMENT.md)
- [PGVector Integration](src/docs/PGVECTOR_INTEGRATION.md)
- [Authentication Debugging](src/docs/GOOGLE_AUTH_TROUBLESHOOTING.md)

## Troubleshooting

### Console Noise Reduction

To reduce development console noise (especially [Fast Refresh] messages), use:

```bash
# Start development with reduced console noise
npm run dev:quiet
```

### Google Authentication Debugging

The system now captures screenshots during the Google authentication process to help with debugging and verification. Screenshots are saved to:

```
src/api/browser-use/screenshots/{userId}/{timestamp-description}.png
```

#### Screenshot Utility Tools

**1. List Screenshots**

View all captured screenshots for debugging:

```bash
node src/scripts/list-screenshots.js
# OR for a specific user
node src/scripts/list-screenshots.js [userId]
```

**2. View Screenshots**

Open a screenshot in your browser:

```bash
node src/scripts/view-screenshot.js [userId] [filename]
```

**3. Test Authentication**

Test Google authentication with screenshot capture:

```bash
# Set environment variables for credentials
export TEST_EMAIL="your-test-email@gmail.com"
export TEST_PASSWORD="your-password"

# Run the test script
node src/scripts/test-google-auth.js
```

**4. API Access**

Screenshots can also be accessed via the API endpoint:

```
/api/compliance/auth-screenshots?userId={userId}&listAll=true
```

### Database Issues

For database-related troubleshooting, refer to the detailed guides in the `/docs` directory.

---

### License & Ownership

All source code, designs, and logic in this repository are the exclusive intellectual property of Paul Backus. This software has not been assigned or transferred to any entity.

Any use, deployment, duplication, or licensing must be approved in writing by the author.

For inquiries: [thebackusagency@gmail.com]

© Paul Backus – All rights reserved.
