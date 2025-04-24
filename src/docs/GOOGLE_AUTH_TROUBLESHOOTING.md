# Google Authentication Troubleshooting Guide

This guide provides solutions for common issues with Google Business Profile authentication in Social Genius.

## Common Issues and Solutions

### Connection Issues

**Problem**: Unable to connect to Browser-Use API  
**Symptoms**: "Browser automation service is currently unavailable" error  
**Solutions**:
1. Check if the browser-use-api container is running: `docker ps | grep browser-use-api`
2. Check browser-use-api logs: `docker logs social-genius-browser-api`
3. Restart the service: `docker restart social-genius-browser-api`

### Authentication Failures

**Problem**: Invalid Credentials  
**Symptoms**: "Authentication failed: WRONG_PASSWORD" error  
**Solutions**:
1. Double-check the email and password
2. Ensure the Google account exists and password is correct
3. Try logging in manually to confirm credentials work

**Problem**: Two-Factor Authentication (2FA)  
**Symptoms**: "Authentication failed: TWO_FACTOR_REQUIRED" error  
**Solutions**:
1. Temporarily disable 2FA on your Google account
2. Complete the authentication in Social Genius
3. Re-enable 2FA afterward

**Problem**: CAPTCHA Challenge  
**Symptoms**: "Authentication failed: CAPTCHA_CHALLENGE" error  
**Solutions**:
1. Login to your Google account manually first using the same browser
2. Wait 30 minutes and try again
3. If persistent, use a different IP address if possible

**Problem**: Suspicious Activity Detection  
**Symptoms**: "Authentication failed: SUSPICIOUS_ACTIVITY" error  
**Solutions**:
1. Login to your Google account manually
2. Resolve any security alerts in your Google account
3. Verify the account with phone/recovery email if prompted
4. Wait 24 hours and try again

**Problem**: Account Locked  
**Symptoms**: "Authentication failed: ACCOUNT_DISABLED" or "TOO_MANY_ATTEMPTS" error  
**Solutions**:
1. Visit accounts.google.com and follow recovery steps
2. Reset your password if required
3. Wait 24 hours before trying again

### Session Issues

**Problem**: Session Expires Too Quickly  
**Symptoms**: Need to re-authenticate frequently  
**Solutions**:
1. Check browser-use-api logs for session errors
2. Ensure cookies are being properly stored
3. Check for Google security settings that might be clearing sessions

**Problem**: "Session not found" errors  
**Symptoms**: Authentication initially succeeds but fails on subsequent operations  
**Solutions**:
1. Check if browser instances are being properly persisted
2. Verify browser-instance-manager is functioning correctly
3. Check for timeouts or session cleanup issues

## Cookie Handling and Trace ID Implementation

### Overview

A comprehensive fix has been implemented to solve session validation issues and enhance debuggability with trace ID propagation. The following improvements were made:

1. **Enhanced cookie handling** - All cookie accesses are now protected with extensive safety checks to prevent "Cannot read properties of undefined (reading 'getAll')" errors.

2. **Cross-component trace ID propagation** - A unique trace ID flows from middleware through API endpoints, allowing for end-to-end tracking of requests.

3. **Comprehensive logging system** - Standardized logging with visual indicators, timing information, and contextual data.

4. **Multiple session recovery mechanisms** - If the primary cookie access fails, we try multiple fallback mechanisms to retrieve session data.

5. **Safe error handling** - Errors are caught, logged with detailed diagnostic information, and returned with trace IDs for easier debugging.

### Modified Files

1. **lib/auth-middleware.ts**
   - Added enhanced cookie access with multiple safety checks
   - Implemented trace ID generation and propagation
   - Added comprehensive error handling and logging
   - Improved session recovery mechanisms

2. **app/api/businesses/route.ts**
   - Added trace ID integration
   - Enhanced cookie handling with proper safety checks
   - Implemented detailed performance tracking
   - Added comprehensive error handling and recovery mechanisms

3. **lib/utilities/browser-logging.ts**
   - Added trace ID generation, propagation, and handling
   - Implemented function context logging with entry/exit points
   - Added detailed performance measurement
   - Implemented standardized log formatting

4. **lib/browser-automation/service-bridge.ts**
   - Added trace ID propagation to Google authentication requests
   - Enhanced error handling and reporting
   - Added detailed performance measurements

### Cookie Access Safety Pattern

Always use this pattern when accessing cookies to avoid "Cannot read properties of undefined" errors:

```typescript
// Safe cookie access pattern
let allCookies: { name: string; value: string }[] = [];
try {
  if (req.cookies && typeof req.cookies.getAll === 'function') {
    allCookies = Array.from(req.cookies.getAll());
  }
} catch (cookieError) {
  log(`Error accessing cookies`, LogLevel.ERROR, {
    error: cookieError instanceof Error ? cookieError.message : String(cookieError)
  });
}

// Safe individual cookie access
let sessionCookie = null;
try {
  if (req.cookies && typeof req.cookies.get === 'function') {
    sessionCookie = req.cookies.get('session');
  }
} catch (getCookieError) {
  log(`Error accessing individual cookie`, LogLevel.ERROR, {
    error: getCookieError instanceof Error ? getCookieError.message : String(getCookieError)
  });
}
```

### Trace ID Propagation Pattern

1. Generate a trace ID at the entry point:
```typescript
const traceId = generateTraceId('auth-mid');
```

2. Create a function context for enhanced logging:
```typescript
const { log, logEntry, logExit } = createFunctionContext(
  'functionName',
  'filePath',
  OperationCategory.AUTH,
  'contextKey',
  traceId
);
```

3. Log entry into the function with context data:
```typescript
logEntry({
  userId,
  method: req.method,
  url: req.url
});
```

4. Add trace ID to API responses:
```typescript
const response = NextResponse.json({
  success: true,
  data: result,
  traceId
}, { status: 200 });
```

5. Log function exit:
```typescript
logExit({
  status: 200,
  success: true
});
```

### Common Cookie and Session Issues

#### 1. "Cannot read properties of undefined (reading 'getAll')" Error

**Problem:** NextRequest.cookies is undefined or does not have the expected methods.

**Solution:** Always check for the existence of req.cookies and its methods before accessing them:

```typescript
const allCookies = req.cookies && typeof req.cookies.getAll === 'function' ? 
  Array.from(req.cookies.getAll()) : [];
```

#### 2. Session Not Found or Invalid

**Problem:** Session cookie is missing or contains invalid data.

**Solution:** 
- Implement multiple session recovery mechanisms
- Check cookie header directly if cookie API fails
- Provide detailed error response with clear fix instructions

#### 3. Debugging Authentication Issues

**Problem:** Hard to trace request flow through the system.

**Solution:**
- Use trace IDs to connect logs across components
- Log entry and exit points with timing information
- Include detailed context in logs (URL, headers, cookie status)
- Add trace IDs to all API responses

### Analyzing Logs with Trace IDs

1. Look for log entries with the same trace ID to follow a request through the system
2. Check for performance bottlenecks using the timing information
3. Use trace IDs in API responses to correlate frontend requests with backend logs
4. Filter logs by trace ID to isolate specific problematic requests

## Debugging Steps

### Viewing Screenshots

Authentication screenshots are captured for both successful and failed attempts. To view them:

1. Go to the browser-use-api container: `docker exec -it social-genius-browser-api /bin/bash`
2. Navigate to the screenshots directory: `cd /app/screenshots`
3. List available screenshots: `ls -la`
4. Copy a screenshot to your local machine:
   ```
   docker cp social-genius-browser-api:/app/screenshots/FILENAME ./FILENAME
   ```

### Checking Logs

For detailed debugging, check logs with these commands:

1. Application logs: `docker logs social-genius_app_1 | grep "GOOGLE-AUTH"`
2. Browser API logs: `docker logs social-genius-browser-api`
3. Database logs: `docker logs social-genius_postgres_1`

### Testing API Endpoints Directly

To test if the browser-use-api is functioning:

```bash
# Check health
curl http://localhost:5055/health

# Test Google Auth (with sample data)
curl -X POST http://localhost:5055/v1/google-auth \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword","businessId":"test-business-id"}'
```

## Advanced Troubleshooting

### Browser Automation Failures

If the browser automation consistently fails:

1. Check if headless mode is causing issues: Modify `browser-use-api/server.py` to set `headless=False`
2. Check if there are version compatibility issues between the browser and automation library
3. Inspect the full browser logs for JavaScript errors: Add `--enable-logging=stderr` to browser launch args

### Database Connection Issues

If task tracking has issues:

1. Verify the browser_tasks table exists: `docker exec -it social-genius_postgres_1 psql -U postgres -d socialgenius -c "\dt"`
2. Check task records: `docker exec -it social-genius_postgres_1 psql -U postgres -d socialgenius -c "SELECT * FROM browser_tasks ORDER BY created_at DESC LIMIT 10;"`
3. Ensure proper indexes exist on the browser_tasks table

### Network Issues

If you're experiencing connectivity issues between containers:

1. Check Docker network configuration: `docker network inspect social_genius_network`
2. Verify that all services are on the same network: `docker network inspect social_genius_network | grep browser-use-api`
3. Test internal connectivity: `docker exec -it social-genius_app_1 curl -s http://browser-use-api:5055/health`

### Memory/Resource Issues

If the system becomes unresponsive during authentication:

1. Check Docker resource utilization: `docker stats`
2. Increase container memory limits if necessary in docker-compose.yml
3. Check for browser memory leaks: look for growing memory usage in `docker stats`

## Preventive Measures

To avoid common issues:

1. **Regular Testing**: Periodically verify authentication works even when not actively using it
2. **Monitoring**: Set up monitoring for browser-use-api health and response times
3. **Backups**: Maintain backup methods for important actions in case automation fails
4. **Google Account Settings**:
   - Use an account without 2FA for automation
   - Use app passwords if 2FA is required
   - Ensure the Google account has appropriate recovery options set

## Support Resources

If you continue experiencing issues:

1. Check the documentation in `/docs/BROWSER_AUTOMATION_ARCHITECTURE.md`
2. Review logs and screenshots for detailed error information
3. Contact support with detailed information about the issue, including:
   - Error messages
   - Screenshots
   - Logs from browser-use-api
   - Steps to reproduce the issue