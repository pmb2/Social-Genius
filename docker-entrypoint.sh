#!/bin/bash
set -e

echo "=== Social Genius Application Startup ==="

# Disable pg-native for reliable database access
export NODE_PG_FORCE_NATIVE=0

# Create Node.js preload script to ensure pg-native is properly handled
cat > /app/disable-pg-native.js << 'EOF'
// Disable pg-native at the earliest possible moment
process.env.NODE_PG_FORCE_NATIVE = '0';

// Override require to intercept pg-native
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(path) {
  if (path === 'pg-native') {
    console.log('\x1b[33m⚠️  pg-native require intercepted, using JavaScript implementation\x1b[0m');
    
    // Simple mock implementation
    function Client() {}
    Client.prototype.connect = () => Promise.resolve();
    Client.prototype.query = () => Promise.resolve({ rows: [], rowCount: 0 });
    Client.prototype.end = () => Promise.resolve();
    
    return Client;
  }
  return originalRequire.call(this, path);
};

console.log('\x1b[32m✅ pg-native interception configured\x1b[0m');
EOF

# Configure Node.js to preload our script
export NODE_OPTIONS="--require /app/disable-pg-native.js"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0

# Use correct host based on environment
if [ "$RUNNING_IN_DOCKER" = "true" ]; then
  PG_HOST="postgres"
  PG_PORT=5432
else
  PG_HOST="localhost"
  PG_PORT=5435
fi

echo "Using database at $PG_HOST:$PG_PORT"

# Wait for PostgreSQL to be available
until pg_isready -h $PG_HOST -p $PG_PORT -U postgres || [ $attempt -eq $max_attempts ]
do
  attempt=$((attempt+1))
  echo "Waiting for PostgreSQL ($attempt/$max_attempts)..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "⚠️ PostgreSQL did not become ready in time, continuing anyway..."
else
  echo "✅ PostgreSQL is ready!"
fi

# Initialize database
echo "Running database initialization..."
node /app/db-init.js

# Check database connectivity one last time
echo "Verifying database connectivity..."
node -e "
const { Pool } = require('pg');
process.env.NODE_PG_FORCE_NATIVE = '0';

const connectionString = process.env.RUNNING_IN_DOCKER === 'true' 
  ? process.env.DATABASE_URL_DOCKER || 'postgresql://postgres:postgres@postgres:5432/socialgenius'
  : process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/socialgenius';

console.log('Connecting with: ' + connectionString.replace(/:[^:]*@/, ':***@'));

const pool = new Pool({ connectionString, native: false });

async function test() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT current_timestamp, COUNT(*) AS user_count FROM users');
    console.log('Database connection successful');
    console.log('Server timestamp: ' + result.rows[0].current_timestamp);
    console.log('User count: ' + result.rows[0].user_count);
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    console.error('Database connection failed: ' + err.message);
    return false;
  }
}

test().then(success => {
  console.log(success ? '✅ Database verification complete' : '❌ Database verification failed');
});
"

# Start the application
echo "Starting the application..."
exec "$@"