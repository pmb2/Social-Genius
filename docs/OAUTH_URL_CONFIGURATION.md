# OAuth URL Configuration

This document explains the OAuth URL configuration changes made to fix the Google OAuth authentication issues.

## Changes Made

1. Updated environment variables to use the production domain:
   - `NEXTAUTH_URL=https://app.social-genius.com`
   - `GOOGLE_REDIRECT_URI=https://app.social-genius.com/api/google-auth/callback`

2. For development mode:
   - Changed server binding from `0.0.0.0` to `localhost` in `docker-compose.dev.yml`
   - Created a script to easily switch between development and production configurations

## Google Cloud Console Configuration

After updating your application's environment variables, you must also update the OAuth settings in Google Cloud Console:

1. Go to [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Update the "Authorized redirect URIs" to include:
   - `https://app.social-genius.com/api/google-auth/callback` (for production)
   - `http://localhost:3000/api/google-auth/callback` (for development)
4. Click "Save"

## Testing the Configuration

After making these changes and updating Google Cloud Console:

1. Rebuild your application:
   ```bash
   # For production
   docker-compose down
   docker-compose up -d --build
   
   # For development
   docker-compose down
   docker-compose -f docker-compose.dev.yml up -d --build
   ```

2. Test the Google OAuth flow:
   - Navigate to the application
   - Attempt to connect a Google Business Profile
   - Verify that you're redirected to Google's OAuth consent screen
   - After granting permission, you should be redirected back to your application without errors

## Switching Between Development and Production

Use the provided script to switch between environments:

```bash
./update-oauth-urls.sh
```

This script will update all necessary configuration files and offer to rebuild the application.

## Troubleshooting

If you encounter OAuth errors after configuration:

1. Check browser developer console for error details
2. Verify that your Google Cloud Console OAuth client has the correct redirect URIs
3. Ensure environment variables are properly set and the application has been rebuilt
4. Check that your domain is correctly configured in Google Cloud Console (Authorized domains)
5. Validate SSL certificates if using HTTPS
6. Check application logs for detailed error messages

Common OAuth error codes:
- `invalid_request`: This usually means the redirect URI doesn't match what's configured in Google Cloud Console
- `unauthorized_client`: The client ID may be incorrect or the application is not properly authorized
- `access_denied`: The user denied the permission request
- `unsupported_response_type`: The response type requested is not supported by the authorization server