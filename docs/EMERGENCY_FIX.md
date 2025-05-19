# Emergency Fix: Temporary Maintenance Mode

This document explains the emergency fix for the 502 Bad Gateway error by implementing a bare-bones maintenance page.

## Problem Analysis

The logs reveal several issues that must be addressed:

1. **Express Route Error**
   - There's a `path-to-regexp` error in the server.cjs file
   - Error: `Missing parameter name at 2: https://git.new/pathToRegexpError`
   - This happens when there's an invalid Express route pattern

2. **Next.js Application Errors**
   - The Next.js application has build errors preventing deployment
   - We need a solution that doesn't depend on Next.js or Express

## Emergency Solution

We've created an ultra-minimal approach that:

1. **Uses No Frameworks**
   - Plain Node.js HTTP server with zero dependencies
   - No Express, Next.js, or other libraries that could fail

2. **Direct Docker Deployment**
   - Uses direct `docker run` commands instead of docker-compose
   - Mounts the server script directly into a Node.js container
   - No build step required

3. **Simplified Nginx Configuration**
   - Uses the existing simplified nginx configuration
   - Maps to port 8080 to avoid conflicts with other services

## How the Fix Works

1. **simple-server.js**
   - Ultra-simple Node.js HTTP server
   - Serves a maintenance page
   - Handles health checks properly
   - Logs requests for debugging

2. **fix-emergency.sh**
   - Stops all existing containers
   - Creates a custom Docker network
   - Launches Node.js and nginx containers directly
   - Tests that the service is working

## Implementing the Fix

Run the emergency fix script:

```bash
./fix-emergency.sh
```

After running the script:
- A maintenance page will be available at http://localhost:8080/
- Health checks will work properly at http://localhost:8080/health
- Direct access is also available at http://localhost:3000/

## Root Cause Analysis

The Express route error is caused by an invalid route pattern. In server.cjs, you have:

```javascript
server.all('/*', (req, res) => {
  return handle(req, res);
});
```

This is causing the path-to-regexp library to fail with "Missing parameter name" because the route pattern is malformed. The correct pattern should be either `'*'` or `'/'` with a wildcard middleware.

## Next Steps After Stabilization

1. **Fix the Server Implementation**
   - Replace the Express route with a working pattern
   - Test the server implementation locally before deploying

2. **Fix Next.js Build Issues**
   - Address the syntax error in init-oauth-db/route.ts
   - Fix the circular reference in next.config.mjs

3. **Port Configuration**
   - Continue using port 8080 instead of 80 if there are conflicts
   - Update any ALB or DNS settings to point to the correct port

This emergency fix provides a stable maintenance page that properly responds to health checks, allowing you time to fix the underlying issues with your application.