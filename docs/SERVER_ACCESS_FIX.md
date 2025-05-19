# Server Access Fix

This document explains how we resolved server accessibility issues to make the application accessible at both localhost:3000 and app.social-genius.com.

## Issues Addressed

1. The Next.js application was not binding properly to make it accessible outside the container
2. The server configuration had a circular reference that caused startup failures
3. The container networking needed improvement to ensure external access

## Solution: Express-based Custom Server

We created a robust CommonJS-based Express server that:

1. Explicitly binds to all interfaces (0.0.0.0)
2. Handles all routing appropriately
3. Provides better error handling and logging

### Key Files Created/Modified

1. `server.cjs` - New Express-based custom server that:
   - Binds to 0.0.0.0 to ensure external accessibility
   - Uses CommonJS for maximum compatibility
   - Includes detailed logging for troubleshooting
   - Has proper error handling

2. `docker-compose.dev.yml` - Updated to use the new server:
   ```yaml
   command: sh -c "echo 'Waiting for database to be ready...' && sleep 5 && echo 'Starting application...' && cd /app && NODE_ENV=development node server.cjs"
   ```

3. `Dockerfile.prod` - Updated to use the new server:
   ```dockerfile
   # Copy our Express server
   COPY --from=builder /app/server.cjs ./

   # Start the application with our Express server
   CMD ["node", "server.cjs"]
   ```

4. `Dockerfile.dev` - Added Express to dependencies:
   ```dockerfile
   RUN npm install @radix-ui/react-dropdown-menu google-auth-library express
   ```

5. `rebuild-dev.sh` - Modified to create the server.cjs file automatically

6. `network-test.sh` - New script for diagnosing network connectivity issues

## How It Works

The custom Express server:

1. Initializes a Next.js application
2. Creates an Express application to handle requests
3. Sets up routes for health checks
4. Forwards all other requests to Next.js
5. Explicitly binds to all network interfaces (0.0.0.0)

This approach ensures the application is accessible:
- From inside the container (localhost:3000)
- From the host machine (localhost:3000)
- From external machines (app.social-genius.com)

## Troubleshooting

If you encounter connectivity issues:

1. Run the `network-test.sh` script to diagnose problems
2. Check container logs with `docker logs social-genius_app_1`
3. Verify port mappings in docker-compose files
4. Ensure no port conflicts on the host machine
5. Confirm Next.js is binding to the correct address (0.0.0.0)

## Additional Considerations

1. **Google OAuth**: This solution preserves Google OAuth functionality while making the app externally accessible
2. **Development vs. Production**: Works in both environments without configuration changes
3. **Security**: Binding to 0.0.0.0 is necessary for container networking, but ensure proper network security elsewhere