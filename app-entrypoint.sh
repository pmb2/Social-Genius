#!/bin/bash

# Wait for PostgreSQL to be ready
echo 'Waiting for PostgreSQL to be ready...'
until pg_isready -h postgres -U postgres; do
  echo 'PostgreSQL not ready yet - waiting...'
  sleep 2
done
echo 'PostgreSQL is ready!'

# Make sure we're using JavaScript implementation
export NODE_PG_FORCE_NATIVE=0

# Create a pg-native mock module to avoid native dependency issues
echo 'Creating mock pg-native module...'
mkdir -p /app/node_modules/pg-native
cat > /app/node_modules/pg-native/index.js << 'EOF'
// Mock pg-native module
// This simply exports the JS client to provide compatibility
exports.Client = require('pg').Client;
EOF

cat > /app/node_modules/pg-native/package.json << 'EOF'
{"name":"pg-native","version":"3.0.0"}
EOF

# Also patch the pg library native loader
echo 'Patching pg library native loader...'
cat > /app/node_modules/pg/lib/native/index.js << 'EOF'
// Use JS client for native
const Client = require('../client');
exports.Client = Client;
EOF

# Create pg-pool patch
echo 'Creating pg-pool patch...'
cat > /app/pg-pool-patch.js << 'EOF'
console.log('Patching pg-pool...');
const fs = require('fs');
const path = require('path');
try {
  const pgPoolPath = path.join(process.cwd(), 'node_modules', 'pg-pool', 'index.js');
  let content = fs.readFileSync(pgPoolPath, 'utf8');
  // Check if the patch has already been applied
  if (content.includes('// PATCHED BY app-entrypoint.sh')) {
    console.log('pg-pool already patched, skipping.');
  } else {
    // Apply the patch to ensure this.Client is correctly initialized
    content = content.replace(
      /(class Pool extends EventEmitter {\s*constructor\(options, Client\) {)/,
      `$1\n    super(); // Added by app-entrypoint.sh`
    );
    fs.writeFileSync(pgPoolPath, content, 'utf8');
    console.log('Successfully patched pg-pool');
  }
} catch(e) {
  console.error('Error patching pg-pool:', e);
}
EOF

# Run the patch
cp /app/scripts/pg-pool-patched.js /app/node_modules/pg-pool/index.js


# Fix Next.js middleware if needed
if [ ! -f '/app/middleware.ts' ]; then
  echo 'Creating middleware.ts file...'
  echo 'export default function middleware() { return; }' > /app/middleware.ts
fi

# Start the application
echo 'Starting application...'
cd /app && npm run dev -- -H 0.0.0.0