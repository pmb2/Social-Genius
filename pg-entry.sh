#!/bin/bash
echo "Starting with database connection fixes..."

# Apply pg-patch
node pg-patch.cjs
# Apply node_modules_patch
if [ -f node_modules_patch.cjs ]; then
  node node_modules_patch.cjs
fi
# Apply direct fixes
if [ -f fix-pg-modules.cjs ]; then
  node fix-pg-modules.cjs
fi
if [ -f fix-pg-constructor.cjs ]; then
  node fix-pg-constructor.cjs
fi

# Export environment variables
export NODE_OPTIONS="--require=/app/pg-constructor-fix-loader.cjs --max-old-space-size=4096"
export NODE_PG_FORCE_NATIVE=0
export PG_DEBUG=true
export DEBUG_DATABASE=true

echo "All fixes applied. Starting application..."
npm run dev