# 502 Bad Gateway Fix

This document outlines the issue with the 502 Bad Gateway error and provides a comprehensive solution.

## Problem Analysis

The 502 Bad Gateway error indicates that the nginx proxy server cannot communicate with the upstream Next.js application. This can happen due to several issues:

1. **Port Binding Issues**: The Next.js app may not be binding to the correct interface (0.0.0.0)
2. **Container Networking**: Issues with communication between nginx and app containers
3. **Server Error**: The Next.js app may be crashing or failing to start
4. **Configuration Problems**: Incorrect nginx configuration or routing
5. **Invalid Next.js Config**: Errors in next.config.mjs causing startup failures

## Solution Strategy

We've created a comprehensive fix that addresses all potential issues:

1. **Simplified Next.js Server**: Created a minimal HTTP server (`plain-server.js`) that:
   - Uses Node's built-in HTTP module instead of Express to reduce dependencies
   - Always binds to 0.0.0.0 to ensure external accessibility
   - Properly handles routing to Next.js
   - Directly handles health check endpoints

2. **Optimized nginx Configuration**: Created a simplified nginx config (`simple.conf`) that:
   - Properly forwards traffic to the Next.js app
   - Supports WebSocket connections
   - Uses increased buffer sizes and timeouts
   - Minimizes unnecessary configuration

3. **Fixed Next.js Configuration**: Created a cleaned-up next.config.mjs that:
   - Removes invalid experimental options
   - Maintains necessary features
   - Avoids circular references
   - Preserves CORS settings for Google OAuth

4. **Direct Port Mapping**: Updated docker-compose to:
   - Map port 80 directly to nginx
   - Simplify container networking
   - Use a cleaner environment setup

## Diagnostic Findings

1. **Express Server Error**: The original Express server had a path routing issue
2. **Next.js Config Warning**: The config had invalid options and circular references
3. **Container Connectivity**: The nginx container was not properly routing to the app
4. **Docker Configuration**: There were potential issues with the container setup

## How to Apply the Fix

1. Run the fix script:
   ```bash
   ./fix-502.sh
   ```

2. This script:
   - Stops all containers
   - Creates the simplified server and nginx configuration
   - Rebuilds and starts containers with the fixed configuration
   - Provides diagnostics to verify the fix worked

## AWS Load Balancer Considerations

If your site is behind an AWS Application Load Balancer (ALB):

1. Ensure the ALB health check points to `/health`
2. Verify the ALB security group allows traffic to your instance
3. Check that the ALB listener rules are correctly configured
4. Consider updating the ALB settings if the 502 persists

## Verification Steps

After applying the fix, verify the solution with:

1. Check the container status: `docker ps -a`
2. Check the logs: `docker-compose -f docker-compose-fix.yml logs`
3. Test local access: `curl localhost`
4. Test external access by visiting app.social-genius.com

## Troubleshooting

If issues persist:

1. Check if nginx is running: `docker ps | grep nginx`
2. Check nginx logs: `docker-compose -f docker-compose-fix.yml logs nginx`
3. Check app logs: `docker-compose -f docker-compose-fix.yml logs app`
4. Try direct access: `curl http://app:3000/health` from the nginx container

## Long-Term Recommendations

1. Monitor server performance and logs
2. Consider implementing proper logging to centralized storage
3. Set up automated health checks and monitoring
4. Create backup and restore procedures to quickly recover from issues