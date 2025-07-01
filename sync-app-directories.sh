#!/bin/bash
set -e  # Exit on error

echo "Synchronizing app directories..."

# Ensure the app directory exists
mkdir -p /mnt/c/Users/TBA/Documents/github/Social-Genius/app

# Copy all files from src/app to app
rsync -av --exclude="node_modules" --exclude=".next" /mnt/c/Users/TBA/Documents/github/Social-Genius/src/app/ /mnt/c/Users/TBA/Documents/github/Social-Genius/app/

# Create a simple middleware.js file that won't have issues
cat > /mnt/c/Users/TBA/Documents/github/Social-Genius/middleware.js << 'EOF'
export default function middleware() {
  return;
}
EOF

# Create a simple middleware.ts file that won't have issues
cat > /mnt/c/Users/TBA/Documents/github/Social-Genius/middleware.ts << 'EOF'
export default function middleware() {
  return;
}
EOF

echo "App directories synchronized successfully!"