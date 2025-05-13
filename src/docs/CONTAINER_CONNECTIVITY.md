# Container Connectivity Troubleshooting Guide

This document provides guidance on diagnosing and resolving Docker container connectivity issues in the Social Genius application, particularly focusing on communication between the main app container and the browser-use-api service.

## Common Connectivity Issues

The most common connectivity issues occur between:

1. **App Container ↔ Browser-Use API**: Authentication and browser automation services
2. **App Container ↔ Redis**: Session management and caching
3. **App Container ↔ Postgres**: Database connectivity

## Quick Diagnostic Test

Run the connectivity test script to check all service connections:

```bash
# Inside the app container
npm run test:connectivity
```

The script will test connectivity to all services and provide detailed error messages and troubleshooting suggestions.

## Common Solutions

### 1. Container Name Resolution

Ensure containers can resolve each other by name on the Docker network:

```bash
# Check if containers are on the same network
docker network inspect social_genius_network

# Test connection from app container to browser-use-api
docker exec -it social-genius-app ping browser-use-api
docker exec -it social-genius-app curl http://browser-use-api:5055/health
```

### 2. Redis Connection Issues

If Redis connectivity fails:

```bash
# Check Redis container status
docker ps | grep redis

# Check Redis logs
docker logs social-genius-redis

# Test Redis connection directly
docker exec -it social-genius-app redis-cli -h redis ping
```

### 3. Restarting Services

Sometimes a simple restart resolves connectivity issues:

```bash
# Restart individual services
docker-compose restart browser-use-api
docker-compose restart redis

# Or restart all services
docker-compose down
docker-compose up -d
```

## Configuration Settings

The following environment variables control service connectivity:

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSER_USE_API_URL` | `http://browser-use-api:5055` | URL for the browser automation API |
| `REDIS_URL` | `redis://redis:6379` | URL for the Redis service |
| `DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/socialgenius` | Postgres connection string |

These are defined in the `docker-compose.yml` and `docker-compose.dev.yml` files.

## Recent Changes

As of the latest update, we've implemented the following improvements to enhance container connectivity:

1. **Robust Redis Connection Management**:
   - Added advanced fallback mechanism with multiple Redis connection URLs
   - Implemented retry logic with exponential backoff and jitter
   - Enhanced error logging with detailed diagnostics
   - Added connection state management for immediate failure detection

2. **Browser API Connectivity**:
   - Created fallback URL system for Browser API with automatic failover
   - Added diagnostic headers to all API requests for better tracing
   - Implemented automated connection testing before critical operations
   - Enhanced session cookie handling with recovery mechanisms

3. **Session Management**:
   - Improved session recovery in authentication flows
   - Fixed session cookie propagation between services
   - Enhanced user ID validation with better error recovery
   - Added detailed logging for session-related errors

4. **System Resilience**:
   - Created container health check script for regular monitoring
   - Added graceful shutdown handlers to prevent connection leaks
   - Updated service communication patterns for better reliability
   - Implemented system-wide health checks with diagnostic information

## Manual Testing

To manually test the browser-use-api from the app container:

```bash
# Test health endpoint
curl http://browser-use-api:5055/health

# Check session
curl http://browser-use-api:5055/v1/session/{businessId}
```

## Additional Resources

- [Docker Networking Guide](https://docs.docker.com/compose/networking/)
- [Redis Connection Troubleshooting](https://redis.io/topics/clients)
- [Detailed Container Logs](#viewing-detailed-logs)

## Viewing Detailed Logs

For detailed logs from all services:

```bash
# View logs from all services
docker-compose logs

# View logs from a specific service
docker-compose logs browser-use-api

# Follow logs in real-time
docker-compose logs -f app
```

## Common Error Patterns and Solutions

### 1. "Session cookie not found before adding business"

This error occurs when attempting to add a new business but the session cookie isn't being properly recognized.

**Solution:**
- We've improved session cookie recovery in the API routes
- The system now attempts to recover sessions from the cookie header directly
- If a valid session is found but not properly parsed, it will be recovered automatically
- For persistent issues, try clearing browser cookies and logging in again

### 2. "Redis connection error: Error: getaddrinfo ENOTFOUND redis"

This indicates DNS resolution issues for the Redis service.

**Solution:**
- Enhanced Redis connection manager now attempts multiple fallback URLs
- Verify the Redis service is running: `docker ps | grep redis`
- Check Redis logs: `docker-compose logs redis`
- Ensure the Redis container is on the same network as the app container

### 3. "API health check failed: connect ECONNREFUSED"

This indicates the Browser API service is unreachable.

**Solution:**
- Implemented fallback URLs to try alternative connection methods
- Added connection retry with backoff to handle temporary network issues
- Check if the service is running: `docker ps | grep browser-use-api`
- Restart the service: `docker-compose restart browser-use-api`
- Verify network connectivity: `docker exec -it social-genius-app ping browser-use-api`

### 4. "Error during browser manager authentication"

This occurs when the browser automation service encounters an error during the authentication process.

**Solution:**
- Added more robust error handling in the authentication flow
- Improved logging for better diagnostics
- Check the browser service logs: `docker-compose logs browser-use-api`
- Verify that Google authentication credentials are correct
- Run the health check script: `npm run test:connectivity`

## Debugging Tools

For advanced debugging, these commands can be helpful:

```bash
# Check Docker network configuration
docker network inspect social_genius_network

# View Docker container environment variables
docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' social-genius-app

# Test network connectivity between containers
docker exec -it social-genius-app sh -c "nc -zv browser-use-api 5055"

# Monitor network traffic
docker exec -it social-genius-app tcpdump -i eth0 host browser-use-api
```