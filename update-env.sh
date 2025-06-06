#!/bin/bash

# Create or update .env file with Google OAuth variables
echo "Updating .env file with Google OAuth credentials..."

if [ -f .env ]; then
  # Backup existing .env file
  cp .env .env.backup
fi

# Add or update Google OAuth variables
cat >> .env << EOF

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-auth/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=random-32-character-encryption-key

# Feature Flags
FEATURE_FLAG_GOOGLE_AUTH_WITH_OAUTH=true
FEATURE_FLAG_ENABLE_GOOGLE_OAUTH_MIGRATION=true
EOF

echo "Environment variables updated. Please edit .env to set your actual Google credentials."
echo "Then restart your containers with: ./rebuild-dev.sh"
echo ""
echo "For testing purposes, you can manually modify the container environment with:"
echo "docker exec social-genius_app_1 /bin/sh -c 'export GOOGLE_CLIENT_ID=your-id'"
echo "docker exec social-genius_app_1 /bin/sh -c 'export GOOGLE_CLIENT_SECRET=your-secret'"
echo "docker exec social-genius_app_1 /bin/sh -c 'export GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-auth/callback'"
echo "docker exec social-genius_app_1 /bin/sh -c 'export GOOGLE_TOKEN_ENCRYPTION_KEY=random-key'"

# Make the script executable
chmod +x update-env.sh