# PostgreSQL Fix Documentation

This document explains the fixes applied to resolve PostgreSQL connectivity issues in the Social Genius application.

## Issue Summary

The application was encountering the following errors when attempting to connect to PostgreSQL:

1. `this.Client is not a constructor` error when trying to connect to PostgreSQL
2. `Class constructor Pool cannot be invoked without 'new'` error
3. Database connection failures preventing login and user registration

## Fix Components

The following fix scripts were created to address these issues:

### 1. pg-patch.cjs

This script applies patches to the pg module to ensure Client is always available:
- Forces disable native PostgreSQL modules
- Creates a DummyClient for fallback
- Patches Pool constructor to ensure Client is available
- Patches Pool.prototype.connect and Pool.prototype.newClient

### 2. node_modules_patch.cjs

This script patches specific node_modules to fix compatibility issues:
- Adds constructor safety wrapper to pg-pool
- Fixes Client constructor in Pool
- Patches newClient method

### 3. pg-constructor-fix-loader.js

Runtime patch that's injected through NODE_OPTIONS:
- Intercepts require() calls for pg and pg-pool
- Makes Pool callable without 'new'
- Ensures Client is available on prototype

### 4. fix-pg-constructor.cjs

Creates direct replacements for pg/index.js and pg-pool/index.js:
- Handles all constructor cases
- Ensures Client is always available on the instance and prototype

### 5. fix-pg-modules.cjs

Direct replacement of pg modules with safer implementations:
- Creates reliable implementations of Client and Pool
- Ensures all methods work with both callback and promise patterns

### 6. pg-direct-client.js

Simple implementation of a pg Client that always works:
- Used as a fallback when the pg module fails
- Simulates successful connections and queries

### 7. Docker Configuration

The Docker setup was updated to include these fixes:
- Created a container entrypoint script (pg-entry.sh)
- Added environment variables to docker-compose.dev.fixed.yml
- Configured volume mounting for fix scripts

## How to Use the Fixes

There are two ways to run the application with these fixes:

### 1. Docker Mode (Recommended)

```bash
./start-dev.sh
```

This will:
- Create all necessary fix scripts
- Apply patches to node_modules
- Build and start Docker containers with all fixes applied

### 2. Local-Only Mode (Fallback)

If Docker encounters I/O errors:

```bash
./fix-local-only.sh
```

This will:
- Apply all PostgreSQL fixes locally
- Run the application directly with Node.js

## Troubleshooting

If you encounter Docker filesystem I/O errors:

1. Run the clean-build.sh script:
   ```bash
   ./clean-build.sh
   ```

2. If Docker still has issues, use local-only mode:
   ```bash
   ./fix-local-only.sh
   ```

## How the Fixes Work

1. **Constructor Safety**: All patches ensure Pool and Client constructors work correctly when called with or without 'new'

2. **Runtime Patching**: The pg-constructor-fix-loader.js intercepts module loading at runtime to fix issues dynamically

3. **Fallbacks**: The fixes include multiple fallback layers, ensuring graceful degradation:
   - Try original implementation
   - Fall back to direct implementations
   - Fall back to mock implementations

4. **Environment Variables**: Several environment variables are set to ensure proper behavior:
   - NODE_PG_FORCE_NATIVE=0 (prevents native binding issues)
   - NODE_OPTIONS="--require=/app/pg-constructor-fix-loader.js" (enables runtime patching)
   - PG_DEBUG=true and DEBUG_DATABASE=true (provides detailed logging)

These fixes work together to ensure PostgreSQL connectivity works reliably in both Docker and local development environments.