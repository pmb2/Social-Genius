# Browser Health Troubleshooting Guide

This guide provides information on diagnosing and resolving browser automation health issues in the Social Genius application. It covers the external Browser-Use API service and the local browser instance manager.

## Table of Contents

1. [Health Check System Overview](#health-check-system-overview)
2. [Common Health Check Issues](#common-health-check-issues)
3. [Troubleshooting API Connectivity](#troubleshooting-api-connectivity)
4. [Troubleshooting Browser Manager Issues](#troubleshooting-browser-manager-issues)
5. [Browser Instance Management](#browser-instance-management)
6. [Interpreting Health Check Results](#interpreting-health-check-results)
7. [Screenshot Testing](#screenshot-testing)
8. [Container Health Check Script](#container-health-check-script)
9. [Debugging and Diagnostics](#debugging-and-diagnostics)

## Health Check System Overview

The browser health check system consists of:

1. **API Endpoint** (`/api/compliance/health`): Provides a web interface to check system health
2. **BrowserOperationService.checkHealth()**: Core method that tests both available browser automation systems:
   - External Browser-Use API
   - Local Browser Instance Manager

The health check performs detailed tests of both systems and returns comprehensive diagnostic information, including:

- External API connectivity status
- Browser manager availability
- Browser instance creation capability
- Memory usage information
- Response times and latency
- Error details when failures occur

## Common Health Check Issues

### 1. External API Connection Failures

| Error Pattern | Likely Cause | Resolution |
|---------------|--------------|------------|
| API health check timeout | Docker container down or networking issue | Restart browser-use-api container |
| Connection refused | Wrong API URL or port | Check `.env` file for correct `BROWSER_USE_API_URL` |
| Network unreachable | Docker network misconfiguration | Check Docker network settings |
| Invalid API response | API version mismatch | Ensure API versions match in config |

### 2. Browser Manager Issues

| Error Pattern | Likely Cause | Resolution |
|---------------|--------------|------------|
| Browser instance creation failure | Missing Playwright dependencies | Run `npx playwright install chromium` |
| Memory allocation error | System resource constraints | Increase container memory limits |
| Timeout during instance creation | Slow system or resource contention | Increase timeout or reduce concurrent instances |
| Browser crashed during test | Playwright compatibility issue | Update Playwright version |

### 3. Overall Health Status Degradation

| Status | Meaning | Action Required |
|--------|---------|----------------|
| Healthy | All systems operational | None |
| Degraded | One system working but another failing | Check logs for specific failure |
| Critical | All systems failing | Complete system restart |

## Troubleshooting API Connectivity

If the external Browser-Use API is unreachable:

1. **Check Docker Status**
   ```bash
   docker ps | grep browser-use-api
   ```

2. **Check Logs**
   ```bash
   docker logs browser-use-api
   ```

3. **Verify API URL Configuration**
   - Check .env file settings:
   ```
   BROWSER_USE_API_URL=http://browser-use-api:5055
   ```
   - In development, use:
   ```
   BROWSER_USE_API_URL=http://localhost:5055
   ```

4. **Test API Directly**
   ```bash
   curl http://localhost:5055/v1/health
   ```

5. **Restart API Container**
   ```bash
   docker-compose restart browser-use-api
   ```

## Troubleshooting Browser Manager Issues

If the browser instance manager is failing:

1. **Check Playwright Installation**
   ```bash
   npx playwright --version
   ```

2. **Install Dependencies**
   ```bash
   npx playwright install chromium
   ```

3. **Check System Resources**
   ```bash
   free -m           # Check memory
   df -h             # Check disk space
   ```

4. **Test Browser Instance Creation**
   - Use the health check's browser instance creation test
   - Look for `connectionTime` in the diagnostics output
   - Times > 5000ms indicate performance issues

5. **Check Library Compatibility**
   - Ensure Playwright version is compatible with Node.js version
   - Check for `Error: Failed to launch browser` in logs

## Browser Instance Management

The browser instance manager maintains a pool of browser instances for reuse:

1. **Instance Lifecycle**
   - Creation: First request creates an instance
   - Reuse: Subsequent requests reuse existing instances
   - Hibernation: Unused instances are hibernated after 30 minutes
   - Cleanup: Hibernated instances are removed after 60 minutes

2. **Diagnosing Instance Problems**
   - Check `instanceCount` and `activeInstances` in health details
   - High instance counts may indicate instances not being cleaned up
   - Low active instances with high failure rate indicates creation issues

3. **Manual Instance Reset**
   - Restart the application to clear all instances
   - Ensure proper shutdown via health endpoint before restart

## Interpreting Health Check Results

The health check returns detailed diagnostic information:

```json
{
  "success": true,
  "systemStatus": "healthy",
  "detailedHealth": {
    "externalServiceHealthy": true,
    "browserManagerAvailable": true,
    "overallHealthy": true,
    "browserDetails": {
      "instanceCount": 2,
      "activeInstances": 1,
      "connectionTime": 1250,
      "memoryUsage": "150MB used of 200MB total"
    },
    "diagnostics": {
      "apiEndpointReachable": true,
      "apiResponseTime": 125,
      "connectionAttempts": 1
    }
  }
}
```

Key metrics to monitor:

- **connectionTime**: Should be < 2000ms for good performance
- **apiResponseTime**: Should be < 500ms
- **instanceCount vs activeInstances**: Large difference indicates hibernated instances
- **memoryUsage**: High values may indicate memory leaks

## Debugging and Diagnostics

For deeper diagnostics:

1. **Enable Verbose Logging**
   - Set environment variable: `BROWSER_VERBOSE_LOGGING=true`
   - Check logs with: 
   ```bash
   docker-compose logs -f app | grep "\[BROWSER-"
   ```

2. **Check Browser Screenshots**
   - Screenshots are captured during browser instance tests
   - Located in `/screenshots` directory
   - Examine for visual clues about browser issues

3. **Test Health Endpoint Directly**
   ```bash
   curl http://localhost:3000/api/compliance/health | jq
   ```

4. **Monitor Memory Usage Over Time**
   - Consistent increases in `memoryUsage` may indicate memory leaks
   - Check for zombie processes:
   ```bash
   ps aux | grep chromium
   ```

5. **Diagnostic Environment Variables**
   - `DEBUG_AUTOMATION=true`: Enables detailed browser automation logs
   - `DEBUG_SCREENSHOTS=true`: Logs screenshot capture events
   - `NODE_ENV=development`: More verbose error messages

## Screenshot Testing

The system includes automated screenshot testing to verify that browser automation is functioning correctly:

1. **Test Script**: `capture-test-screenshot.js`
   - Launches a browser instance
   - Navigates to Google.com
   - Takes a screenshot and saves it to the screenshots directory
   - Verifies that the screenshot is a valid PNG file

2. **Running the Test**
   ```bash
   npm run test:screenshot
   ```

3. **Interpreting Screenshot Test Results**
   - Successful test will create a PNG file in the screenshots directory
   - Test will verify the PNG file header to ensure it's valid
   - Test will output the file size and location for verification

4. **Common Screenshot Test Issues**
   
   | Issue | Likely Cause | Resolution |
   |-------|--------------|------------|
   | Test fails to launch browser | Missing Playwright dependencies | Run `npx playwright install chromium` |
   | Invalid PNG file | Browser rendering issue | Check system graphics drivers |
   | Permission denied | Directory permissions issue | Run `chmod -R 755` on screenshots directory |
   | Screenshot capture timeout | System resource constraints | Increase memory allocation |

5. **Screenshot Verification**
   - Screenshots can be viewed directly in the filesystem
   - Location: `/home/ubuntu/Social-Genius/src/api/browser-use/screenshots/`
   - Organized by user ID and timestamp
   - Each screenshot contains a description in the filename

## Container Health Check Script

A comprehensive container health check script is included to verify all components of the system:

1. **Running the Health Check**
   ```bash
   npm run health:check
   ```

2. **Health Check Components**
   - Browser API connectivity
   - Redis connectivity
   - Postgres connectivity
   - Host network connectivity
   - Screenshot capability verification
   - Directory permissions
   - Environment variable validation

3. **Health Check Output**
   ```
   ============================================
   Health Check Summary:
   Browser API: OK
   Redis: OK
   Postgres: OK
   host.docker.internal: OK
   Working Redis URL: redis://localhost:6380
   Screenshots Directory: OK
   Screenshot Test: OK
   ============================================
   ```

4. **Fixing Common Health Check Issues**
   - Browser API failure: Restart browser-use-api container
   - Redis failure: Update Redis URL or restart Redis container
   - Postgres failure: Check database credentials and restart Postgres
   - Screenshot test failure: Check Playwright installation and permissions

5. **Automated Checks in CI/CD**
   - The health check script can be incorporated into CI/CD pipelines
   - Use `--ci` flag for machine-readable output in CI environments
   - Exit code 0 indicates all checks passed, non-zero indicates failure

For further assistance, contact the development team or open an issue in the project repository.