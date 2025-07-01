#!/bin/bash

# Set JavaScript implementation
export NODE_PG_FORCE_NATIVE=0

# Create a pg-native mock module to avoid native dependency issues
echo 'Creating mock pg-native module...'
mkdir -p /app/node_modules/pg-native
cat > /app/node_modules/pg-native/index.js << 'EOF'
// Mock pg-native module that delegates to the JavaScript client
const pg = require('pg');
exports.Client = pg.Client;
EOF

cat > /app/node_modules/pg-native/package.json << 'EOF'
{
  "name": "pg-native",
  "version": "3.0.0",
  "description": "JavaScript-only implementation of pg-native for compatibility",
  "main": "index.js",
  "private": true,
  "license": "MIT"
}
EOF

# Also patch the pg library native loader
echo 'Patching pg library native loader...'
cat > /app/node_modules/pg/lib/native/index.js << 'EOF'
// Mock native implementation using JavaScript client
const Client = require('../client');
exports.Client = Client;
EOF

echo 'All patches applied successfully!'