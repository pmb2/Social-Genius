# Production Deployment Fix

This document explains the fixes applied to resolve the 502 Bad Gateway error while maintaining Google OAuth integration.

## Issue Description

We encountered a 502 Bad Gateway error when accessing the application at app.social-genius.com. This happened after we:

1. Updated the Google OAuth redirect URI to use the production domain
2. Changed binding from 0.0.0.0 to localhost in development

## Root Cause

The root cause was that in production, the Next.js application was not properly binding to all network interfaces (0.0.0.0), which meant it couldn't receive requests from outside the container, leading to the 502 error.

## Solution

We implemented several fixes to ensure the application works correctly in both environments:

### 1. Custom Server Implementation

Created a custom Next.js server (custom-server.js) that explicitly binds to 0.0.0.0 in production:

```javascript
// custom-server.js
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Always bind to all interfaces in production container
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Parse URL
      const parsedUrl = parse(req.url, true);
      
      // Let Next.js handle the request
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    
    // Log server startup
    console.log(`> Ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
    console.log(`> NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
    console.log(`> Google Redirect: ${process.env.GOOGLE_REDIRECT_URI || 'not set'}`);
  });
});
```

### 2. Updated Dockerfile

Modified the Dockerfile.prod to use our custom server:

```dockerfile
# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/custom-server.js ./

...

# Start the application with our custom server
CMD ["node", "custom-server.js"]
```

### 3. Next.js Configuration

Updated next.config.mjs to ensure correct hosting configuration:

```javascript
output: 'standalone',
experimental: {
  ...nextConfig.experimental,
  hostname: "0.0.0.0", 
  port: 3000,
},
```

### 4. Environment Configuration

Ensured that environment variables are correctly set for production:

- `NEXTAUTH_URL=https://app.social-genius.com`
- `GOOGLE_REDIRECT_URI=https://app.social-genius.com/api/google-auth/callback`

## Development vs. Production

This setup allows for different binding behavior in different environments:

- **Development**: Binds to localhost in development mode (better for local testing)
- **Production**: Binds to 0.0.0.0 in production (necessary for container networking)

Both environments correctly use their respective OAuth redirect URIs.

## Testing the Fix

After implementing these changes:

1. Rebuild the production Docker image:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

2. Verify the application is accessible at https://app.social-genius.com

3. Test the Google OAuth flow to ensure it works correctly with the production domain

## Additional Notes

- The Next.js standalone output mode is used for better compatibility with Docker
- The custom server approach gives us more control over the networking configuration
- All OAuth redirect URIs must also be configured in the Google Cloud Console