#!/bin/bash
# Script to reset the users database

echo "🔴 WARNING: This will delete all users and related data!"
echo "Please confirm this action by typing 'RESET' (all caps):"
read confirmation

if [ "$confirmation" != "RESET" ]; then
    echo "Operation cancelled."
    exit 1
fi

echo "Starting database reset process..."

# Determine if we should use Docker or direct connection
if command -v docker &> /dev/null && docker ps | grep -q "social-genius-postgres"; then
    echo "Using Docker container for database reset"
    
    # Create a temporary SQL file
    cat > reset_users.sql << EOF
-- Start transaction
BEGIN;

-- Disable foreign key constraints temporarily
SET CONSTRAINTS ALL DEFERRED;

-- First, truncate dependent tables
TRUNCATE sessions CASCADE;
TRUNCATE notifications CASCADE;
TRUNCATE businesses CASCADE;
TRUNCATE task_logs CASCADE;

-- Finally, truncate the users table
TRUNCATE users CASCADE;

-- Re-enable constraints
SET CONSTRAINTS ALL IMMEDIATE;

-- Commit transaction
COMMIT;

-- Verify counts
SELECT 'Users count: ' || COUNT(*) FROM users;
SELECT 'Sessions count: ' || COUNT(*) FROM sessions;
SELECT 'Businesses count: ' || COUNT(*) FROM businesses;
EOF

    # Execute SQL through Docker
    docker exec -i social-genius-postgres psql -U postgres -d socialgenius < reset_users.sql
    
    # Clean up
    rm reset_users.sql
    
    echo "✅ Database reset complete!"
else
    echo "Docker not found or PostgreSQL container not running"
    echo "Please make sure the database container is running or use node scripts/reset-users.js"
    exit 1
fi

echo ""
echo "🚀 You can now create new users with proper password handling"