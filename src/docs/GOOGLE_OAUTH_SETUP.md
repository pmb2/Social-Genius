# Google OAuth Setup Guide

This guide explains how to set up Google OAuth for the Google Business Profile API integration in Social Genius.

## Overview

Social Genius uses the Google OAuth 2.0 flow to authenticate with the Google Business Profile API. This allows the application to manage business profiles, access account information, and perform operations on behalf of users.

## Prerequisites

1. A Google Cloud Platform (GCP) project
2. Google Business Profile API enabled in your GCP project
3. OAuth consent screen configured
4. OAuth credentials (Client ID and Client Secret)

## Required Packages

Make sure you have the necessary packages installed:

```bash
# Install the Google Auth Library
npm install google-auth-library --save
```

This package is used for OAuth 2.0 authentication with Google APIs. If you're using Docker, the package should already be included in the container, but you can verify with:

```bash
docker exec social-genius_app_1 npm list google-auth-library
```

If it's not installed in the container, you can install it with:

```bash
docker exec social-genius_app_1 npm install google-auth-library --save
```

## Step 1: Create a Google Cloud Platform Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Make note of your project ID

## Step 2: Enable the Google Business Profile API

1. In your GCP project, go to "APIs & Services" > "Library"
2. Search for "Business Profile API" and "My Business API"
3. Enable both APIs for your project

## Step 3: Configure the OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace account)
3. Fill in the required information:
   - App name: "Social Genius"
   - User support email: Your email
   - Developer contact information: Your email
4. Add the following scopes:
   - `https://www.googleapis.com/auth/business.manage`
5. Add any test users (email addresses) who will be testing the application

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Name: "Social Genius Web Client"
5. Authorized JavaScript origins: `http://localhost:3000` (for development)
6. Authorized redirect URIs: `http://localhost:3000/api/google-auth/callback` (for development)
7. Click "Create"
8. Note down your Client ID and Client Secret

## Step 5: Configure Environment Variables

Add the following environment variables to your `.env` file:

```
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-auth/callback"
GOOGLE_TOKEN_ENCRYPTION_KEY="random-encryption-key" # Generate a random string

# Feature flags for controlling Google OAuth behavior
FEATURE_FLAG_GOOGLE_AUTH_WITH_OAUTH=true
FEATURE_FLAG_ENABLE_GOOGLE_OAUTH_MIGRATION=true
```

You can use the provided setup script to help with this:

```bash
./update-env.sh
```

> **Important Note**: After updating the `.env` file, you need to restart your Docker containers for the changes to take effect. You can do this with:
> 
> ```bash
> ./rebuild-dev.sh
> ```

### Environment Variables in Docker

If you're using Docker Compose, these environment variables are automatically passed to the containers from your `.env` file or from environment variables set before starting the containers.

You can verify that the environment variables are correctly set in the container with:

```bash
docker exec social-genius_app_1 env | grep GOOGLE
```

## Step 6: Verify Configuration

1. Start your development server: `npm run dev`
2. Open your application and try to connect a Google Business Profile
3. You should be redirected to Google's authentication page
4. After authentication, you should be redirected back to your application

## Troubleshooting

### Common Issues

1. **"Error: redirect_uri_mismatch"**: Make sure your redirect URI exactly matches what's configured in the GCP console.

2. **"Error: invalid_client"**: Double-check your Client ID and Client Secret in your environment variables.

3. **"Error: access_denied"**: The user denied permission or the OAuth consent screen doesn't have the right scopes.

4. **Module not found: Can't resolve 'google-auth-library'**: The package is missing. Install it using:
   ```bash
   npm install google-auth-library --save
   ```
   If you're using Docker, install it in the container with:
   ```bash
   docker exec social-genius_app_1 npm install google-auth-library --save
   ```

5. **"Failed to prepare authentication"**: This is a general error that can have multiple causes:
   - Missing environment variables: Check that all the required variables are set
   - Database initialization errors: The application should automatically create the necessary tables
   - API connectivity issues: Make sure the Google APIs are accessible from your network

6. **Database initialization errors**: The application will automatically create the necessary tables. If there are errors, check the console logs. You can also manually check if the tables exist with:
   ```bash
   docker exec social-genius_app_1 npx ts-node -e "const { DatabaseService } = require('./src/services/database'); const db = DatabaseService.getInstance(); db.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = \\'public\\' AND table_name = \\'google_oauth_tokens\\');').then(console.log).catch(console.error);"
   ```

### Debug Endpoints

Use these endpoints to diagnose OAuth issues:

- `/api/google-auth/check-credentials`: Checks if OAuth environment variables are configured correctly
- `/api/feature-flags/check`: Verifies feature flag configuration (useful for OAuth enabling/disabling)

### Console Logging

Enable detailed logging by adding this to your `.env` file:

```
DEBUG=google-oauth,google-api,database
```

## Database Schema

The Google OAuth integration uses these database tables:

1. `google_oauth_tokens`: Stores access and refresh tokens
2. `google_oauth_states`: Manages state during the OAuth flow (prevents CSRF)
3. `google_business_accounts`: Maps Google accounts to business records
4. `google_business_locations`: Stores location information for businesses

These tables are automatically created when needed.

## Feature Flags

Google OAuth can be controlled by feature flags in the database:

- `google_auth_with_oauth`: Determines if OAuth is used instead of browser automation
- `enable_google_oauth_migration`: Controls migration from browser automation to OAuth

By default, these flags are enabled in development mode.

## References

- [Google Identity: Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Business Profile API Documentation](https://developers.google.com/my-business/content/overview)
- [Google Cloud Console](https://console.cloud.google.com/)