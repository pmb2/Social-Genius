# Browser-Use API Integration Guide

This document describes the integration of the Browser-Use API service for Google Business Profile automation.

## Overview

The Browser-Use API service allows Social Genius to:

1. Automate Google account authentication for business owners
2. Create, manage, and update Google Business Profiles programmatically
3. Capture screenshots for error reporting and debugging
4. Maintain separate browser instances for each business
5. **NEW: Persistent Sessions** - Maintain authenticated sessions across requests

## Setup Instructions

We've prepared a setup script to handle all necessary migrations and dependencies. Follow these steps:

1. Ensure your application is properly checked out with the updates:
   ```bash
   git checkout revert-backup  # Or your current branch
   ```

2. Run the setup script to install dependencies and perform database migrations:
   ```bash
   ./setup-migrations.sh
   ```

3. Start the application using the standard development script:
   ```bash
   ./start-dev.sh
   ```

4. If you encounter any issues, rebuild the application:
   ```bash
   ./rebuild-dev.sh
   ```

## Key Components

- **browser-use-api/**: Docker container that provides automated browser interactions
- **lib/browser-automation/**: Client library for interacting with the Browser-Use API
- **app/api/google-auth/**: API endpoints for Google authentication
- **components/google-auth-form.tsx**: UI component for collecting Google credentials securely

## Environment Variables

The following environment variable is automatically set in the Docker Compose configuration:

- `BROWSER_USE_API_URL`: http://browser-use-api:5055

## Database Schema Updates

The setup includes the following database schema changes:

1. New columns in the `businesses` table:
   - `google_auth_status`
   - `google_email`
   - `google_credentials_encrypted`
   - `google_auth_timestamp`

2. New `task_logs` table for tracking automation tasks with columns:
   - `task_id`
   - `business_id`
   - `task_type`
   - `status`
   - `result`
   - `error`
   - `screenshot_path`
   - `created_at`
   - `updated_at`

## Session Management

The new session management feature provides persistent authentication to Google accounts:

### Key Features

1. **Session Persistence**: Maintains authenticated Google sessions across requests
2. **Session Reuse**: Avoids repeated logins by reusing valid sessions
3. **Cookie Storage**: Securely stores and retrieves authentication cookies
4. **Session Validation**: Verifies session validity before use
5. **Auto-Refresh**: Keeps sessions alive through periodic refreshing

### How it Works

Sessions are stored in two places:

1. **In-memory cache**: For fast access during the API server's runtime
2. **File-based storage**: For persistence across server restarts (`browser-use-api/browser_sessions/`)

Each session contains:
- Cookies from the authenticated browser
- localStorage data
- sessionStorage data
- Timestamps for tracking freshness

### Authentication Flow

1. **First login**:
   - Check if an existing session exists for the business ID
   - If not, proceed with a full authentication using the provided credentials
   - After successful authentication, extract and save the session (cookies, localStorage, etc.)

2. **Subsequent requests**:
   - Check if a valid session exists
   - Validate the session by attempting to access a Google account page
   - If valid, reuse the session without requiring re-authentication
   - If invalid, perform a full authentication again

### Session API Endpoints

- `GET /v1/session/{business_id}`: Check if a session exists
- `GET /v1/session/{business_id}/validate`: Test if a session is still valid

## Troubleshooting

If you encounter issues with the Browser-Use API:

1. Check if the container is running:
   ```bash
   docker ps | grep browser-use-api
   ```

2. View the container logs:
   ```bash
   docker logs social-genius-browser-api
   ```

3. Check the screenshots directory for error captures:
   ```bash
   ls -la browser-use-api/screenshots/
   ```

4. Test the API directly:
   ```bash
   curl http://localhost:5055/health
   ```

5. Check session status:
   ```bash
   curl http://localhost:5055/v1/session/{business_id}
   ```

6. Validate a session:
   ```bash
   curl http://localhost:5055/v1/session/{business_id}/validate
   ```

## Security Considerations

- Google credentials are encrypted before storage
- Sessions are stored locally in the Docker container
- Screenshots are stored locally and not exposed publicly
- API access is restricted to the internal Docker network