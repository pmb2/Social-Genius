#!/bin/bash

# Script to update OAuth URLs for development/production environments
# This script updates environment variables and rebuilds the application

set -e

# Display the current environment
echo "Current environment:"
if [ -f .env ]; then
    echo "NEXTAUTH_URL: $(grep NEXTAUTH_URL .env | cut -d '=' -f2)"
    echo "GOOGLE_REDIRECT_URI: $(grep GOOGLE_REDIRECT_URI .env | cut -d '=' -f2)"
fi

# Function to update URLs for development
update_for_development() {
    echo "Updating for development environment..."
    
    # Update .env file
    sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://localhost:3000|' .env
    sed -i 's|GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-auth/callback|' .env
    
    # Update docker-compose.dev.yml to use localhost 
    # This is for development only - production will always bind to 0.0.0.0 via custom-server.js
    sed -i 's|-H 0.0.0.0|-H localhost|' docker-compose.dev.yml
    
    echo "Environment updated for development. URLs now point to localhost:3000"
}

# Function to update URLs for production
update_for_production() {
    echo "Updating for production environment..."
    
    # Update .env file
    sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://app.social-genius.com|' .env
    sed -i 's|GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=https://app.social-genius.com/api/google-auth/callback|' .env
    
    echo "Environment updated for production. URLs now point to app.social-genius.com"
}

# Let the user choose the environment
echo ""
echo "Select environment to configure:"
echo "1) Development (localhost:3000)"
echo "2) Production (app.social-genius.com)"
read -p "Enter your choice (1/2): " choice

case $choice in
    1)
        update_for_development
        ;;
    2)
        update_for_production
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Ask if user wants to rebuild and restart
echo ""
read -p "Do you want to rebuild and restart the application? (y/n): " rebuild

if [ "$rebuild" = "y" ] || [ "$rebuild" = "Y" ]; then
    echo "Stopping existing containers..."
    docker-compose down
    
    if [ "$choice" = "1" ]; then
        echo "Rebuilding for development..."
        docker-compose -f docker-compose.dev.yml up -d --build
    else
        echo "Rebuilding for production..."
        docker-compose up -d --build
    fi
    
    echo "Application has been rebuilt and restarted with new settings."
else
    echo "Environment updated. Remember to rebuild and restart the application for changes to take effect."
fi

# Display the new environment
echo ""
echo "Updated environment:"
if [ -f .env ]; then
    echo "NEXTAUTH_URL: $(grep NEXTAUTH_URL .env | cut -d '=' -f2)"
    echo "GOOGLE_REDIRECT_URI: $(grep GOOGLE_REDIRECT_URI .env | cut -d '=' -f2)"
fi

echo ""
echo "IMPORTANT: After updating the OAuth redirect URIs in your environment,"
echo "you must also update them in your Google Cloud Console OAuth configuration:"
echo "https://console.cloud.google.com/apis/credentials"
echo ""
echo "Make sure to add these authorized redirect URIs to your OAuth client:"
echo "- http://localhost:3000/api/google-auth/callback (for development)"
echo "- https://app.social-genius.com/api/google-auth/callback (for production)"
echo ""