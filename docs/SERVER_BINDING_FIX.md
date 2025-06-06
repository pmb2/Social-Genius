# Server Binding Fix

This document explains how we fixed the server binding issues to accommodate both development and production environments while maintaining Google OAuth compatibility.

## Issue Description

We encountered two main issues:

1. A 502 Bad Gateway error in production when binding to `localhost` instead of `0.0.0.0`
2. A circular reference error in the Next.js config causing the application to fail to start:
   ```
   ReferenceError: Cannot access 'nextConfig' before initialization
   ```

## Root Causes

1. **Binding Issue**: In production, the application needs to bind to all network interfaces (`0.0.0.0`) to be accessible from outside the container, but for Google OAuth in development, we were binding to `localhost`.

2. **Config Error**: We had a circular reference in the Next.js configuration where we were trying to spread `nextConfig.experimental` inside the definition of `nextConfig` itself.

## Solution

### 1. Custom Server Implementation

Created a flexible custom server implementation that adapts to the environment:

```javascript
// custom-server.js
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
// In development, use localhost if specified in the HOST env var, otherwise use 0.0.0.0
// In production, always use 0.0.0.0 to bind to all interfaces
const hostname = process.env.NODE_ENV === 'production' 
  ? '0.0.0.0' 
  : (process.env.HOST || 'localhost');
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server with hostname: ${hostname}, port: ${port}, env: ${process.env.NODE_ENV}`);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ... server implementation
```

### 2. Next.js Configuration Fix

Fixed the circular reference by consolidating all experimental options:

```javascript
experimental: {
  // Enable app directory
  appDir: true,
  // These packages will only be used server-side
  serverComponentsExternalPackages: [
    'pg', 
    'playwright', 
    'playwright-core',
    'bcryptjs',
  ],
  // Additional settings...
  // For binding to all interfaces in production
  hostname: "0.0.0.0", 
  port: 3000,
  // File tracing settings...
},
```

### 3. Docker Configuration Updates

Updated Docker configurations to use our custom server:

#### Production (Dockerfile.prod)
```dockerfile
# Start the application with our custom server
CMD ["node", "custom-server.js"]
```

#### Development (docker-compose.dev.yml)
```yaml
command: sh -c "echo 'Waiting for database to be ready...' && sleep 5 && echo 'Starting application...' && cd /app && NODE_ENV=development HOST=localhost node custom-server.js"
```

### 4. Build Script Improvements

Modified the rebuild-dev.sh script to:
- Ensure the custom server file is present
- Skip non-existent files gracefully
- Add better error handling and logging

## Environment Handling

The solution creates an environment-aware approach:

- **Development**: Binds to `localhost` to ensure Google OAuth works correctly
- **Production**: Binds to `0.0.0.0` to ensure the app is accessible from outside the container

Both cases use the appropriate NEXTAUTH_URL and GOOGLE_REDIRECT_URI environment variables for their respective environments.

## Testing

After implementing these changes, the application should:

1. Start correctly in development mode with no circular reference errors
2. Be accessible at `localhost:3000` in development
3. Be accessible at `app.social-genius.com` in production
4. Work correctly with Google OAuth in both environments

## Future Considerations

1. Consider using environment variables for binding controls rather than hard-coding in the server file
2. Set up automatic testing of the OAuth flow during deployment
3. Add more detailed logging around the binding and network configuration