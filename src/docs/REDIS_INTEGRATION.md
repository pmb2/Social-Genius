# Redis Integration for Browser Automation

This document outlines the implementation of Redis for session sharing across browser automation services.

## Overview

Redis integration enables persistent browser sessions and state management across multiple services and process restarts. This is critical for maintaining authenticated sessions with Google Business Profiles and ensuring a consistent user experience.

## Implementation Components

### 1. Redis Session Manager

The `RedisSessionManager` (`/src/services/compliance/redis-session-manager.ts`) provides:

- Session storage and retrieval with TTL (time-to-live)
- Serialization of browser cookies and storage state
- Business ID and email indexing for quick lookups
- Atomic operations using Redis transactions
- Distributed locking for concurrent access
- Automatic session expiration and cleanup

### 2. Browser Instance Manager with Redis Integration

The enhanced `BrowserInstanceManager` (`/src/services/compliance/browser-instance-manager.ts`) now:

- Loads persisted sessions from Redis on startup
- Serializes and saves browser cookies and storage to Redis
- Restores browser state from Redis when reactivating sessions
- Coordinates browser instances across multiple processes
- Handles graceful shutdown with session persistence

### 3. Error Handling Infrastructure

The `error-types.ts` module (`/src/lib/error-types.ts`) provides:

- Standardized error types and error codes
- Category-based error classification
- Retry logic with exponential backoff
- User-friendly error messages with recovery suggestions
- Structured error logging with context information

### 4. Docker Configuration

Updated Docker Compose files to include:

- Redis service with persistent storage
- Redis Commander for development monitoring
- Environment variables for Redis configuration
- Health checks for service reliability
- Proper service dependencies

## Integration with Existing Code

The Redis session manager is integrated with:

- **Browser Instance Manager**: Manages Playwright browser instances with session persistence
- **Consolidated Auth Service**: Handles Google authentication with improved state management
- **Browser-Use API**: Will be updated to use the same Redis instance for cross-service coordination

## Usage

### Session Operations

```typescript
// Get existing session or create new one
const sessionManager = RedisSessionManager.getInstance();

// Create a new session
const session = await sessionManager.createSession({
  businessId: 'business-123',
  email: 'user@example.com',
  status: 'active'
});

// Retrieve a session
const existingSession = await sessionManager.getSession(session.id);

// Update a session
await sessionManager.updateSession(session.id, {
  cookiesJson: JSON.stringify(cookies),
  storageJson: JSON.stringify({ localStorage, sessionStorage })
});

// Get sessions for a business
const businessSessions = await sessionManager.getSessionsByBusiness('business-123');

// Find active session for a business
const activeSession = await sessionManager.getActiveSession('business-123');

// Delete a session
await sessionManager.deleteSession(session.id);
```

### Browser Instance Management

```typescript
// Get browser instance manager
const manager = new BrowserInstanceManager();

// Get or create a browser instance for a business
const instanceKey = await manager.getOrCreateInstance('business-123');

// Get browser components
const { browser, context, page, agno } = await manager.getInstanceComponents(instanceKey);

// Update activity timestamp
manager.updateInstanceActivity(instanceKey);

// Remove instance
await manager.removeInstance(instanceKey);
```

### Error Handling

```typescript
// Import error utilities
import { createError, ErrorCodes, ErrorRetry } from '@/lib/error-types';

// Create a typed error
const error = createError(
  ErrorCodes.AUTH_INVALID_CREDENTIALS,
  'Invalid email or password',
  {
    traceId: 'trace-123',
    businessId: 'business-123'
  }
);

// Function with automatic retries
const result = await ErrorRetry.withRetry(
  async () => {
    // Operation that might fail
    return await authenticateGoogle(email, password);
  },
  {
    maxAttempts: 3,
    baseDelay: 1000,
    onRetry: (error, attempt, delay) => {
      console.log(`Retrying after ${delay}ms (attempt ${attempt}): ${error.message}`);
    }
  }
);
```

## Configuration

Configuration is done through environment variables:

- `REDIS_URL`: Redis connection string (default: `redis://redis:6379`)
- `REDIS_PREFIX`: Key prefix for Redis keys (default: `social-genius:`)
- `SESSION_TTL`: Session time-to-live in seconds (default: `86400` - 24 hours)

## Docker Configuration

Redis is configured in both production and development environments:

**Production** (`docker-compose.yml`):
```yaml
redis:
  image: redis:alpine
  container_name: social-genius-redis
  ports:
    - "6380:6379"
  volumes:
    - redis_data:/data
    - ./src/config/redis.conf:/usr/local/etc/redis/redis.conf
  restart: unless-stopped
  command: redis-server /usr/local/etc/redis/redis.conf
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 5s
    retries: 5
  networks:
    - social_genius_network
```

**Development** (`docker-compose.dev.yml`):
```yaml
redis:
  image: redis:alpine
  container_name: social-genius-redis
  ports:
    - "6380:6379"
  volumes:
    - redis_data:/data
    - ./src/config/redis.conf:/usr/local/etc/redis/redis.conf
  restart: unless-stopped
  command: redis-server /usr/local/etc/redis/redis.conf
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 5s
    retries: 5
  networks:
    - social_genius_network

redis-commander:
  image: rediscommander/redis-commander:latest
  restart: always
  environment:
    - REDIS_HOSTS=local:redis:6379
  ports:
    - "8081:8081"
  depends_on:
    - redis
  networks:
    - social_genius_network
```

## Connectivity Testing

A new connectivity test script has been added to help diagnose issues between containers:

```bash
# Run the connectivity test
npm run test:connectivity
```

This script tests connections between:
- App container ↔ Browser-Use API service
- App container ↔ Redis
- App container ↔ Postgres

The script provides detailed error reporting and troubleshooting suggestions.

## Next Steps

1. ✅ **Container Connectivity**: Updated Docker configuration for reliable container communication
2. ✅ **Redis URL Configuration**: Fixed Redis URL to use service name for consistent connectivity
3. ✅ **Healthchecks**: Added comprehensive healthchecks to all services
4. ✅ **Connectivity Testing**: Added test scripts to diagnose connectivity issues
5. **Browser-Use API Redis Integration**: Extend the Python FastAPI server to use Redis for cross-service session synchronization
6. **Automated Testing**: Create automated tests for session persistence and recovery
7. **Monitoring Dashboard**: Implement monitoring for Redis and session statistics
8. **Advanced Retry Logic**: Enhance the error handling with more sophisticated retry mechanisms
9. **Rate Limiting**: Add Redis-based rate limiting to prevent account lockouts

## Documentation

For more information on container connectivity and troubleshooting, see:
- [Container Connectivity Guide](CONTAINER_CONNECTIVITY.md)
- [Browser Automation Architecture](BROWSER_AUTOMATION_ARCHITECTURE.md)
- [Google Auth Flow](GOOGLE_AUTH_FLOW.md)