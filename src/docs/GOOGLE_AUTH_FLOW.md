# Google Business Profile Authentication Flow

This document outlines the complete Google Business Profile authentication process in Social Genius, including the frontend-to-backend interactions, API calls, browser automation, and the enhanced tracing and logging system.

## Overview

The Google Business Profile authentication flow allows users to connect their Google Business profiles to Social Genius for compliance checks and management features. The process involves:

1. User opens the add a business modal from the dashboard
2. User enters business name, and hits the next button 
3. User provides Google Business Profile credentials (email, password)
4. Backend processes the credentials, initiates a browser-use instance for that business and calls the login automation task
5. Browser-use login automation service logs into Google Business Profile
6. Authentication result is returned to the frontend
7. Upon successful authentication, we store the session, cookie and all other data that helps us maintain persistent access to their account
8. Once login is successful and we have saved the persistence data, the browser-use automation task to scrape all of the users google business details, posts, reviews and all other data and we stroe it all in the database.

## Detailed Flow with Logging 

### 1. Frontend Flow - Business Profile Creation/Edit

#### 1.1 User Initiates Business Profile Creation

When a user opens the business profile modal from the dashboard, the frontend logs this action:

```typescript
// Log when user opens business profile modal with a trace ID for tracking
const traceId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
console.log(`[BUSINESS_AUTH:${traceId}] 🚀 STARTING GOOGLE AUTH FLOW - FRONTEND INITIATED`);
console.log(`[BUSINESS_AUTH:${traceId}] User opened business profile modal`);
```

#### 1.2 User Enters Business Details and Proceeds

After entering the business name and clicking next, the frontend log documents this step:

```typescript
// Add logging for business creation attempt
console.log(`[BUSINESS_AUTH:${traceId}] User submitting business profile details:`, 
  JSON.stringify({
    businessName,
    businessType,
    hasCredentials: false // Will be prompted for credentials next
  })
);
console.log(`[BUSINESS_AUTH:${traceId}] Proceeding to Google authentication step`);
```

#### 1.3 User Provides Google Credentials

The frontend handles the Google credential submission process as implemented in `components/compliance-tab.tsx`:

```typescript
// Generate comprehensive trace ID for full-stack tracking
const traceId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
console.log(`[BUSINESS_AUTH:${traceId}] 🚀 STARTING GOOGLE AUTH FLOW - FRONTEND INITIATED`);
console.log(`[BUSINESS_AUTH:${traceId}] Business ID: ${businessId}`);
console.log(`[BUSINESS_AUTH:${traceId}] Flow initiated from: Compliance Tab`);

// Check for cookies before submitting to catch issues early
console.log(`[BUSINESS_AUTH:${traceId}] 🍪 CHECKING SESSION COOKIES`);
const hasSessionCookie = document.cookie.split(';').some(cookie => 
  cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
);

if (!hasSessionCookie) {
  console.error(`[BUSINESS_AUTH:${traceId}] ⚠️ No session cookie found, refreshing session`);
  
  // Initiate session refresh if needed
  const sessionResponse = await fetch('/api/auth/session?r=' + Math.random(), {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Cache-Control': 'no-cache',
      'X-Trace-ID': traceId
    }
  });
  
  console.log(`[BUSINESS_AUTH:${traceId}] Session refresh status: ${sessionResponse.status}`);
}

// Input validation with detailed logging
console.log(`[BUSINESS_AUTH:${traceId}] 🔍 VALIDATING USER INPUT`);

// If validation passes, send authentication request
console.log(`[BUSINESS_AUTH:${traceId}] 📡 SENDING AUTHENTICATION REQUEST`);
const response = await fetch('/api/compliance/auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Trace-ID': traceId
  },
  body: JSON.stringify({
    businessId,
    email,
    password, // In production, this would be encrypted
    persistBrowser: true,
    enableExtendedLogging: true,
    traceId // Include trace ID for correlation
  }),
});
```

### 2. API Route - `/api/compliance/auth`

The API route in `app/api/compliance/auth/route.ts` processes authentication requests with comprehensive logging:

```typescript
// Generate a unique trace ID for tracking this request through the system
const traceId = generateTraceId('auth-api');

// Log entry into this file with the trace ID
logFileEntry('/app/api/compliance/auth/route.ts', traceId);

// Create a function context for the POST handler
const { log } = createFunctionContext(
  'POST',
  '/app/api/compliance/auth/route.ts',
  OperationCategory.AUTH,
  'google-auth-api',
  traceId
);

log(`🚀 GOOGLE AUTH API REQUEST RECEIVED`, LogLevel.INFO, {
  url: req.nextUrl.toString(),
  method: req.method,
  timestamp: new Date().toISOString()
});

// Check authentication first
const authService = AuthService.getInstance();
log(`Beginning authentication check and session verification`, LogLevel.INFO);

// Parse and validate cookies
const cookies = await measurePerformance(
  'Parse cookies',
  async () => authService.parseCookies(cookieHeader || ''),
  OperationCategory.AUTH,
  traceId
);

const sessionId = cookies.session || cookies.sessionId;

if (!sessionId) {
  log(`No session cookie found`, LogLevel.ERROR);
  return NextResponse.json({ 
    success: false, 
    error: 'Authentication required',
    traceId
  }, { status: 401 });
}

// Get credentials from request body
const { 
  businessId, 
  email, 
  encryptedPassword, 
  nonce, 
  version, 
  persistBrowser = true,
  enableExtendedLogging = false
} = body;

log(`Request parameters received`, LogLevel.INFO, {
  businessId,
  email,
  hasEncryptedPassword: !!encryptedPassword,
  persistBrowser,
  enableExtendedLogging
});

// Import the BrowserOperationService
const { BrowserOperationService } = await import('@/lib/browser-automation/service-bridge');
const browserOpService = BrowserOperationService.getInstance();

// Check browser service health
const healthStatus = await measurePerformance(
  'Check browser service health',
  async () => browserOpService.checkHealth(),
  OperationCategory.BROWSER,
  traceId
);

log(`Browser health check completed`, LogLevel.INFO, { healthStatus });

// Initialize browser automation
authTask = await browserOpService.authenticateGoogle(
  businessId,
  email,
  {
    encryptedPassword,
    nonce,
    version
  }
);

log(`Authentication task completed`, LogLevel.INFO, {
  taskId: authTask.taskId,
  status: authTask.status
});

// Return the task ID for status tracking with session headers
const response = NextResponse.json({
  success: true,
  taskId: authTask.taskId,
  browserInstanceId: finalBrowserInstanceId,
  message: 'Authentication task started successfully',
  traceId // Include trace ID for client-side logging
});

// Add session ID to header for the browser-use-api
response.headers.set('X-Session-ID', sessionId);
response.headers.set('X-Trace-ID', traceId);
```

### 3. Browser Automation Service Bridge

The service bridge in `lib/browser-automation/service-bridge.ts` connects the application to the browser automation service:

```typescript
// Generate a trace ID if one wasn't provided
const authTraceId = traceId || generateTraceId(`auth-${businessId}`);

// Create a function context for enhanced logging
const { log, logEntry, logExit } = createFunctionContext(
  'authenticateGoogle',
  'service-bridge.ts',
  OperationCategory.AUTH,
  `auth-${businessId}`,
  authTraceId
);

// Log entry into this function
logEntry({
  businessId,
  email,
  hasCredentials: !!credentials,
  timestamp: new Date().toISOString()
});

// Decrypt credentials if necessary
const password = await measurePerformance(
  'Decrypt credentials',
  async () => {
    if (typeof credentials === 'string') {
      log(`Using plain string credentials`, LogLevel.INFO);
      return credentials;
    } else {
      log(`Decrypting credentials`, LogLevel.INFO);
      return unwrapCredentials(credentials);
    }
  },
  OperationCategory.SECURITY,
  authTraceId
);

// Check health of external automation service
let externalServiceHealthy = false;
await measurePerformance(
  'Check external service health',
  async () => {
    try {
      externalServiceHealthy = await this.automationService.checkHealth();
      log(`External automation service health check: ${externalServiceHealthy ? 'HEALTHY' : 'UNHEALTHY'}`, 
        externalServiceHealthy ? LogLevel.INFO : LogLevel.WARN
      );
    } catch (healthError) {
      log(`External automation service health check failed`, LogLevel.ERROR, { error: healthError });
      externalServiceHealthy = false;
    }
  },
  OperationCategory.API,
  authTraceId
);

// If external service is healthy, use it
if (externalServiceHealthy) {
  log(`Using external automation service for authentication`, LogLevel.INFO);
  
  const result = await measurePerformance(
    'External service authentication',
    async () => this.automationService.authenticateGoogle(
      businessId,
      email,
      password
    ),
    OperationCategory.AUTH,
    authTraceId
  );
  
  // Add trace ID to the result
  const resultWithTrace = {
    ...result,
    traceId: authTraceId
  };
  
  logExit(resultWithTrace);
  return resultWithTrace;
}

// Fall back to browser manager if available
log(`Attempting to load browser manager`, LogLevel.INFO);
const browserManagerModule = await loadBrowserManager();

if (browserManagerModule) {
  log(`Falling back to browser manager for authentication`, LogLevel.INFO);
  
  // Create browser instance and perform login
  const browserInstance = await measurePerformance(
    'Create browser instance',
    async () => browserManagerModule.createBrowserInstance(
      businessId,
      { 
        headless: true,
        traceId: authTraceId
      }
    ),
    OperationCategory.BROWSER,
    authTraceId
  );
  
  const result = await measurePerformance(
    'Browser manager login',
    async () => browserInstance.performLogin({
      credentials: { email, password },
      traceId: authTraceId
    }),
    OperationCategory.AUTH,
    authTraceId
  );
  
  // Return standardized result
  return {
    taskId: `local-${Date.now()}`,
    businessId,
    status: result.success ? 'success' : 'failed',
    error: result.error,
    traceId: authTraceId
  };
}
```

### 4. Browser-Use API Service

The Python-based Browser-Use API service (`browser-use-api/server.py`) handles the actual browser automation:

```python
# In the google_auth route
@app.post("/api/google/auth")
async def google_auth(request: AuthRequest):
    # Generate operation ID for logging across the entire request
    op_id = f"auth-{request.businessId}-{int(time.time())}"
    
    logger.info(f"[BROWSER_API:{op_id}] 📝 Received authentication request for business {request.businessId}")
    logger.info(f"[BROWSER_API:{op_id}] Email: {request.email}, Timeout: {request.timeout}ms")
    
    # Extract session from request if present
    session_id = request.headers.get("x-session-id")
    trace_id = request.headers.get("x-trace-id", op_id)
    
    logger.info(f"[BROWSER_API:{op_id}] 🔍 Request trace ID: {trace_id}")
    logger.info(f"[BROWSER_API:{op_id}] 🔑 Session ID: {session_id[:8]}... if provided")
    
    # Check if we already have a valid session
    if request.reuseSession and session_id:
        logger.info(f"[BROWSER_API:{op_id}] 🔄 Checking for existing session")
        session_valid = await check_session_validity(request.businessId, session_id)
        
        if session_valid:
            logger.info(f"[BROWSER_API:{op_id}] ✅ Existing session is valid, reusing")
            return {
                "task_id": f"reused-{int(time.time())}",
                "status": "completed",
                "result": {
                    "success": True,
                    "message": "Successfully reused existing session"
                }
            }
    
    # Create a new browser task
    task_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    logger.info(f"[BROWSER_API:{op_id}] 🆕 Created task ID: {task_id}")
    
    # Store task in database
    await store_task(task_id, request.businessId, "login", "in_progress")
    
    # Start browser automation in background
    asyncio.create_task(perform_google_login(
        task_id=task_id,
        business_id=request.businessId,
        email=request.email,
        password=request.password,
        timeout=request.timeout,
        op_id=op_id,
        trace_id=trace_id,
        session_id=session_id,
        advanced_options=request.advanced_options
    ))
    
    logger.info(f"[BROWSER_API:{op_id}] 🚀 Started background authentication task {task_id}")
    
    # Return task ID for client to poll
    return {
        "task_id": task_id,
        "status": "in_progress",
        "message": "Authentication task started"
    }

# Background task for Google login
async def perform_google_login(task_id, business_id, email, password, timeout, op_id, trace_id, session_id, advanced_options):
    try:
        logger.info(f"[BROWSER_API:{op_id}] 🔄 Initializing browser automation agent")
        
        # Initialize browser with proper configuration
        browser = await initialize_browser(
            headless=True,
            proxy=advanced_options.get("proxy"),
            user_agent=advanced_options.get("user_agent")
        )
        
        # Execute login sequence
        logger.info(f"[BROWSER_API:{op_id}] 🔑 Agent navigating to Google login page")
        await browser.goto("https://accounts.google.com/signin")
        
        # Perform human-like delays between actions
        delay_min = advanced_options.get("human_delay_min", 1)
        delay_max = advanced_options.get("human_delay_max", 3)
        
        # Enter email
        logger.info(f"[BROWSER_API:{op_id}] 👆 Agent entering email address")
        await browser.fill("input[type=email]", email)
        await browser.wait_for_timeout(random.uniform(delay_min, delay_max) * 1000)
        await browser.click("#identifierNext")
        
        # Wait for password field and enter password
        await browser.wait_for_selector("input[type=password]", timeout=10000)
        logger.info(f"[BROWSER_API:{op_id}] 👆 Agent proceeding to password page")
        await browser.wait_for_timeout(random.uniform(delay_min, delay_max) * 1000)
        
        logger.info(f"[BROWSER_API:{op_id}] 👆 Agent entering password")
        await browser.fill("input[type=password]", password)
        await browser.wait_for_timeout(random.uniform(delay_min, delay_max) * 1000)
        await browser.click("#passwordNext")
        
        # Capture screenshot of final state
        screenshot = await browser.screenshot()
        
        # Check login result
        logger.info(f"[BROWSER_API:{op_id}] 🔍 Agent checking login result")
        success = await check_login_success(browser)
        
        if success:
            logger.info(f"[BROWSER_API:{op_id}] ✅ Authentication successful for business {business_id}")
            
            # Store session cookies if login successful
            if advanced_options.get("persist_session", True):
                cookies = await browser.cookies()
                await store_session_cookies(business_id, cookies)
                logger.info(f"[BROWSER_API:{op_id}] 💾 Saved {len(cookies)} session cookies")
            
            # Update task status
            await update_task(task_id, "completed", {
                "success": True,
                "screenshot": base64.b64encode(screenshot).decode("utf-8"),
                "sessionSaved": advanced_options.get("persist_session", True)
            })
        else:
            # Check for specific failure reasons
            error_message = await detect_error_reason(browser)
            logger.info(f"[BROWSER_API:{op_id}] ❌ Authentication failed: {error_message}")
            
            # Update task status with error
            await update_task(task_id, "failed", {
                "success": False,
                "error": error_message,
                "errorCode": await determine_error_code(error_message),
                "screenshot": base64.b64encode(screenshot).decode("utf-8")
            })
        
        # Close browser
        await browser.close()
        
    except Exception as e:
        logger.error(f"[BROWSER_API:{op_id}] 💥 Error during authentication: {str(e)}")
        traceback.print_exc()
        
        # Update task with error
        await update_task(task_id, "failed", {
            "success": False,
            "error": str(e),
            "errorCode": "AUTOMATION_ERROR"
        })
```

### 5. Result Propagation Back to Frontend

The frontend polls for task completion and updates the UI accordingly:

```typescript
// Poll for status until we get a final result or timeout
const maxPolls = 30; // Maximum number of polling attempts
console.log(`[BUSINESS_AUTH:${traceId}] Will attempt up to ${maxPolls} status checks`);

while (authStatus === 'in_progress' && progressCheck < maxPolls) {
  progressCheck++;
  
  try {
    // Wait between checks with exponential backoff
    const waitTime = Math.min(1000 * Math.pow(1.5, progressCheck - 1), 8000);
    console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Waiting ${waitTime}ms before poll attempt ${progressCheck}/${maxPolls}`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Check the status
    console.log(`[BUSINESS_AUTH:${traceId}] 🔄 POLL ATTEMPT ${progressCheck}/${maxPolls}`);
    const statusUrl = `/api/compliance/task-status?taskId=${result.taskId}&t=${Date.now()}&traceId=${traceId}`;
    
    const statusResponse = await fetch(statusUrl, {
      headers: {
        'X-Trace-ID': traceId,
        'Cache-Control': 'no-cache'
      }
    });
    
    const statusResult = await statusResponse.json();
    console.log(`[BUSINESS_AUTH:${traceId}] Poll result status: ${statusResult.status}`);
    
    // Process based on status
    if (statusResult.status === 'success') {
      console.log(`[BUSINESS_AUTH:${traceId}] ✅ AUTHENTICATION SUCCEEDED`);
      authStatus = 'success';
      
      // Close the auth modal and update UI
      setIsAuthModalOpen(false);
      
      // Clear credentials from state for security
      setEmail("");
      setPassword("");
      
      // Run compliance check to update status with authenticated data
      await performComplianceCheck(true);
      
      break;
    } 
    else if (statusResult.status === 'failed') {
      console.error(`[BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FAILED`);
      
      // Get detailed error message based on error code
      let detailedErrorMessage = statusResult.error || "Authentication failed";
      
      // Update UI with error
      setAuthError(detailedErrorMessage);
      break;
    }
  } catch (pollError) {
    console.error(`[BUSINESS_AUTH:${traceId}] ❌ POLLING ERROR:`, pollError);
    break;
  }
}

// Calculate total auth flow time
const totalAuthTime = Date.now() - requestStartTime;
console.log(`[BUSINESS_AUTH:${traceId}] ⏱️ Total authentication flow time: ${totalAuthTime}ms`);
```

## Sequence Diagram

```
┌─────────┐          ┌─────────┐          ┌─────────────┐          ┌────────────┐          ┌────────────┐
│ Frontend │          │ Next.js │          │ Browser     │          │ Browser    │          │ Google     │
│ UI      │          │ API     │          │ Service     │          │ Use API    │          │ Auth       │
└────┬────┘          └────┬────┘          └──────┬──────┘          └──────┬─────┘          └──────┬─────┘
     │                     │                      │                        │                       │
     │  1. Submit Auth     │                      │                        │                       │
     │─────────────────────>                      │                        │                       │
     │                     │                      │                        │                       │
     │                     │  2. Authenticate     │                        │                       │
     │                     │─────────────────────>│                        │                       │
     │                     │                      │                        │                       │
     │                     │                      │  3. Call Browser API   │                       │
     │                     │                      │───────────────────────>│                       │
     │                     │                      │                        │                       │
     │                     │                      │                        │  4. Automated Login   │
     │                     │                      │                        │──────────────────────>│
     │                     │                      │                        │                       │
     │                     │                      │                        │  5. Login Result      │
     │                     │                      │                        │<──────────────────────│
     │                     │                      │                        │                       │
     │                     │                      │  6. Task ID Response   │                       │
     │                     │                      │<───────────────────────│                       │
     │                     │                      │                        │                       │
     │                     │  7. Return Task ID   │                        │                       │
     │                     │<─────────────────────│                        │                       │
     │                     │                      │                        │                       │
     │  8. Poll Status     │                      │                        │                       │
     │─────────────────────>                      │                        │                       │
     │                     │                      │                        │                       │
     │                     │  9. Check Status     │                        │                       │
     │                     │─────────────────────>│                        │                       │
     │                     │                      │                        │                       │
     │                     │                      │  10. Task Status       │                       │
     │                     │                      │───────────────────────>│                       │
     │                     │                      │                        │                       │
     │                     │                      │  11. Status Response   │                       │
     │                     │                      │<───────────────────────│                       │
     │                     │                      │                        │                       │
     │                     │  12. Return Status   │                        │                       │
     │                     │<─────────────────────│                        │                       │
     │                     │                      │                        │                       │
     │  13. Update UI      │                      │                        │                       │
     │<─────────────────────                      │                        │                       │
     │                     │                      │                        │                       │
┌────┴────┐          ┌────┴────┐          ┌──────┴──────┐          ┌──────┴─────┐          ┌──────┴─────┐
│ Frontend │          │ Next.js │          │ Browser     │          │ Browser    │          │ Google     │
│ UI      │          │ API     │          │ Service     │          │ Use API    │          │ Auth       │
└─────────┘          └─────────┘          └─────────────┘          └────────────┘          └────────────┘
```

## Authentication Methods and Fallbacks

The system implements multiple authentication methods with automatic fallbacks:

1. **Session Reuse**: First checks if a valid session already exists
   ```typescript
   // Log attempt to reuse session
   console.log(`[BROWSER_SERVICE:${operationId}] Attempting to reuse existing session for business ${businessId}`);
   ```

2. **External Browser Service**: Uses browser-use-api as primary method
   ```typescript
   console.log(`[BROWSER_SERVICE:${operationId}] Using external browser automation service`);
   ```

3. **Internal Browser Manager**: Falls back to local browser instance if external fails
   ```typescript
   console.log(`[BROWSER_SERVICE:${operationId}] External service unavailable, falling back to browser manager`);
   ```

## Enhanced Error Handling

The authentication flow includes robust error handling at each stage:

```typescript
// In the authenticateGoogle method
try {
  // Authentication logic...
} catch (error) {
  console.error(`[BROWSER_SERVICE:${operationId}] ❌ Authentication error: ${error.message}`);
  console.error(`[BROWSER_SERVICE:${operationId}] Stack trace: ${error.stack}`);
  // Generate diagnostic information
  const diagnosticInfo = {
    timestamp: new Date().toISOString(),
    operationId,
    businessId,
    errorType: error.name,
    errorMessage: error.message,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'unknown'
  };
  console.error(`[BROWSER_SERVICE:${operationId}] Diagnostic info: ${JSON.stringify(diagnosticInfo)}`);
  
  return {
    taskId: 'error',
    businessId,
    status: 'failed',
    error: `Authentication failed: ${error.message}`
  };
}
```

## Enhanced Tracing and Logging System

Our new logging system provides comprehensive tracing across all components with unique trace IDs that flow through the entire authentication process.

### Trace ID Generation and Propagation

Trace IDs are generated at the beginning of the authentication flow and passed through all components:

```typescript
// In frontend (components/compliance-tab.tsx)
const traceId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
console.log(`[BUSINESS_AUTH:${traceId}] 🚀 STARTING GOOGLE AUTH FLOW - FRONTEND INITIATED`);

// Sending to API with trace ID
const response = await fetch('/api/compliance/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // ...other fields
    traceId // Pass trace ID to API
  })
});

// In API route (app/api/compliance/auth/route.ts)
// Use the provided trace ID or generate a new one
const traceId = req.body.traceId || generateTraceId('auth-api');
logFileEntry('/app/api/compliance/auth/route.ts', traceId);

// Pass to service bridge
const authTask = await browserOpService.authenticateGoogle(
  businessId,
  email,
  credentials,
  traceId // Pass trace ID to service bridge
);

// Return trace ID in response for client-side correlation
return NextResponse.json({
  success: true,
  taskId: authTask.taskId,
  traceId // Return trace ID to frontend
});
```

### Function Context Logging

The new system provides function context with entry/exit logging:

```typescript
// Create a function context for enhanced logging
const { log, logEntry, logExit } = createFunctionContext(
  'authenticateGoogle',  // Function name
  'service-bridge.ts',   // File path
  OperationCategory.AUTH, // Operation category
  `auth-${businessId}`,  // Context key
  authTraceId            // Trace ID
);

// Log entry into this function
logEntry({ businessId, email });

// Log operations with different levels
log(`Starting Google authentication process`, LogLevel.INFO, {
  businessId, email
});

// Log exit from function with result
logExit(result);
```

### Performance Measurement

All critical operations are measured and logged:

```typescript
// Measure performance of operations
const result = await measurePerformance(
  'Browser manager login',         // Operation name
  async () => browserInstance.performLogin(loginOptions), // Operation function
  OperationCategory.AUTH,          // Category
  traceId                          // Trace ID
);
```

### Standardized Log Format

Logs follow a consistent format for easy filtering and analysis:

```
[BROWSER-{CATEGORY}:{TIMESTAMP}][{TRACE_ID}] {ICON} [{PID}:{LEVEL}] [{CATEGORY}] {MESSAGE} {DATA}
```

Example:
```
[BROWSER-AUTH:12:34:56.789][auth-12345-abc123] 🔐 [1234:info] [auth] Starting Google authentication process {"businessId":"b123","email":"user@example.com"}
```

### Visual Indicators

Each log category and level has a visual indicator for easy scanning:

- 🔐 Auth operations
- 🌐 API operations
- 🖥️ Browser operations
- 🔑 Session operations
- ⚙️ Configuration
- 📋 Task operations
- 🔍 Debug logs
- ℹ️ Info logs
- ⚠️ Warning logs
- ❌ Error logs
- 🔬 Trace logs

## Common Issues and Debugging

### Tracking Issues with Trace IDs

The application now includes a comprehensive tracing system that allows pinpointing issues throughout the authentication flow. Each operation is assigned a trace ID that propagates through all components from frontend to backend.

```bash
# Search for a specific trace ID in all logs
grep "auth-12345" logs/*.log

# Watch logs in real-time filtered by trace ID
tail -f logs/*.log | grep "auth-12345"

# Extract performance metrics for a specific trace ID
grep "auth-12345" logs/*.log | grep "completed in" | cut -d" " -f6-8

# Sort logs chronologically for a trace ID
grep "auth-12345" logs/*.log | sort -k2
```

In the frontend console, you can easily identify all related log entries for a specific authentication attempt by filtering for the trace ID that's generated when the process starts.

### Session Cookie Problems

A common issue is missing session cookies when making authentication requests. The enhanced flow now includes automatic session cookie detection and refresh:

**Debug steps:**
1. Check browser console for cookie warnings - look for `[BUSINESS_AUTH:${traceId}] 🍪 CHECKING SESSION COOKIES`
2. Look for the warning message `[BUSINESS_AUTH:${traceId}] ⚠️ No session cookie found, refreshing session`
3. The frontend will automatically attempt to refresh the session before proceeding
4. Verify that cookies are enabled in the browser - the system now tests this explicitly
5. Check session refresh response status with `[BUSINESS_AUTH:${traceId}] Session refresh status: ${statusCode}`

If cookies are disabled in the browser, the system will detect this and provide a clear error message to the user.

### Browser Service Connectivity

The new implementation includes enhanced health checks and fallback mechanisms for browser service connectivity issues:

**Debug steps:**
1. Look for `[BROWSER_SERVICE:${traceId}] External automation service health check: UNHEALTHY` log messages
2. Examine the health diagnostics in logs: `[BROWSER_SERVICE:${traceId}] Health check completed` 
3. Check if the browser-use-api container is running: `docker ps | grep browser-use-api`
4. Check browser-use-api logs: `docker logs social-genius-browser-api`
5. Verify network connectivity between containers: `docker network inspect social-genius_social_genius_network`

The system will automatically attempt to fall back to a local browser manager if the external service is unavailable, increasing reliability:

```
[BROWSER_SERVICE:${traceId}] Falling back to browser manager for authentication
```

### Authentication Failures

When Google authentication fails, the system now provides detailed error diagnostics:

**Debug steps:**
1. Check the frontend logs for the specific error code and message:
   ```
   [BUSINESS_AUTH:${traceId}] ❌ AUTHENTICATION FAILED
   [BUSINESS_AUTH:${traceId}] Error code: WRONG_PASSWORD
   ```

2. Detailed error types are now provided by the system:
   - `WRONG_PASSWORD`: Incorrect credentials
   - `ACCOUNT_LOCKED`: Too many failed attempts
   - `VERIFICATION_REQUIRED`: Additional verification needed
   - `TWO_FACTOR_REQUIRED`: 2FA is enabled
   - `SUSPICIOUS_ACTIVITY`: Google security trigger
   - `BROWSER_SERVICE_UNHEALTHY`: Service issue
   - `TIMEOUT`: Request took too long
   
3. Examine browser API logs for detailed error information:
   ```
   [BROWSER_API:${op_id}] ❌ Authentication failed: ${error_message}
   ```

4. Review screenshots automatically captured during authentication:
   ```
   [BROWSER_API:${op_id}] 💾 Saved screenshot of authentication error
   ```

5. Use the trace ID to follow the complete authentication flow across all systems:
   ```bash
   grep "${traceId}" logs/*.log | sort -k2
   ```

## Implementation Status

Our Google Authentication flow implementation has the following components:

### Completed Components

1. ✅ **Frontend Authentication UI**
   - Business profile modal with step-by-step flow
   - Google credentials form with validation
   - Error handling with detailed messages

2. ✅ **Trace ID Generation and Propagation**
   - Unique IDs for tracking requests across systems
   - Headers and request parameter passing
   - Correlated logging between frontend and backend

3. ✅ **Authentication API Endpoint**
   - `/api/compliance/auth` endpoint for credential processing
   - Session validation and management
   - Proper error handling and response formatting

4. ✅ **Browser Automation Service Bridge**
   - Connection to the Browser-Use API
   - Fallback mechanisms for increased reliability
   - Performance measurement and logging

5. ✅ **Browser-Use API Service**
   - Python-based automation service
   - Task management system
   - Screenshot capturing and storage

### Components In Progress

1. ⏳ **Session Management Improvements**
   - Enhanced session persistence
   - Automatic session renewal
   - Better error recovery

2. ⏳ **Error Classification System**
   - More detailed error categorization
   - User-friendly error messages
   - Automated troubleshooting suggestions

3. ⏳ **Captcha and Two-Factor Handling**
   - Detection of advanced authentication challenges
   - Recovery strategies for complex auth flows
   - User assistance for verification steps

### Planned Enhancements

1. 🔄 **Authentication Metrics Dashboard**
   - Real-time success rates
   - Performance monitoring
   - Error trend analysis

2. 🔄 **Enhanced Security Features**
   - Client-side credential encryption
   - Rate limiting and abuse prevention
   - Advanced token management

3. 🔄 **Multi-Account Management**
   - Support for multiple Google accounts per business
   - Role-based access control
   - Delegation capabilities

## Security Considerations

The Google authentication flow implementation incorporates several security best practices:

1. **Credential Handling**: 
   - Credentials are never logged or stored in plaintext
   - Password fields are properly masked in the UI
   - Clear variables after use to prevent memory leaks

2. **Session Security**: 
   - Session tokens are transmitted over HTTPS only
   - Token validation on every request
   - Secure cookie settings including HttpOnly and SameSite

3. **Token Management**:
   - Google auth sessions are refreshed periodically
   - Maximum session lifetime of 7 days
   - Automatic invalidation of compromised sessions

4. **Audit Logging**: 
   - All authentication attempts are logged with timestamps
   - IP addresses and user agents are recorded
   - Filtering capability to identify suspicious patterns

5. **Error Handling**:
   - Error messages are sanitized before returning to frontend
   - Detailed errors are logged for debugging but not exposed to users
   - Standardized error codes to categorize issues

## Testing the Authentication Flow

To test the complete authentication flow:

1. Start the development environment: `./start-dev.sh`
2. Open the application in your browser
3. Navigate to the dashboard and open the business profile modal
4. Enter a business name and proceed to the authentication step
5. Enter Google Business Profile credentials
6. Monitor the console logs with the trace ID for detailed flow information
7. Check the `/api/compliance/task-status` endpoint polling
8. Verify successful auth with the browser-use-api screenshots

For testing error scenarios, you can use the following test accounts:
- `test@example.com` / `password123` - Basic successful login
- `fail@example.com` / `wrongpass` - Wrong password error
- `2fa@example.com` / `password123` - Two-factor authentication error
- `locked@example.com` / `password123` - Account locked error

## Environment Variables and Configuration

The enhanced Google authentication system can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSER_USE_API_URL` | URL of the browser automation service | `http://browser-use-api:5055` |
| `BROWSER_VERBOSE_LOGGING` | Enable detailed logging for browser automation | `false` |
| `BROWSER_POLLING_INTERVAL` | Base interval for status polling (ms) | `1000` |
| `BROWSER_MAX_POLL_ATTEMPTS` | Maximum number of polling attempts | `30` |
| `BROWSER_AUTH_TIMEOUT` | Authentication timeout in milliseconds | `120000` |
| `LOG_LEVEL` | Minimum log level (debug, info, warn, error) | `info` |
| `ENABLE_FALLBACK_BROWSER` | Enable local browser fallback | `true` |
| `SESSION_PERSISTENCE_DAYS` | Days to keep Google sessions valid | `7` |

These can be set in your `.env.development` file:

```
BROWSER_VERBOSE_LOGGING=true
LOG_LEVEL=debug
BROWSER_AUTH_TIMEOUT=180000
```

Or when running the development server:

```bash
LOG_LEVEL=debug BROWSER_VERBOSE_LOGGING=true npm run dev
```

## Troubleshooting Commands

Here are some useful commands for debugging the Google Auth flow:

```bash
# Check if browser-use-api is running
docker ps | grep browser-use-api

# View browser-use-api logs
docker logs social-genius-browser-api

# Check API health directly
curl http://localhost:5055/health

# View authentication logs
cat logs/auth.log

# Filter logs by trace ID
grep "auth-12345" logs/*.log

# Restart browser service if it's stuck
docker restart social-genius-browser-api

# Watch logs in real-time filtered by trace ID
tail -f logs/*.log | grep "auth-12345"

# Sort logs chronologically for a trace ID
grep "auth-12345" logs/*.log | sort -k2

# Extract performance metrics for a specific flow
grep "auth-12345" logs/*.log | grep "completed in" | cut -d" " -f6-8

# Count authentication attempts by status
grep "AUTHENTICATION" logs/auth.log | grep -c "SUCCEEDED"
grep "AUTHENTICATION" logs/auth.log | grep -c "FAILED"

# List all error codes encountered in the last 24 hours
grep "Error code:" logs/auth.log | grep "$(date -d '24 hours ago' +'%Y-%m-%d')" | awk '{print $NF}' | sort | uniq -c

# Check for session persistence issues
grep "Saved session cookies" logs/auth.log | tail -n 20

# Verify database connectivity for session storage
docker exec social-genius_postgres_1 pg_isready
```

## Integration with Other Systems

The Google Auth flow integrates with several other systems in the Social Genius platform:

### 1. Business Profile System
After successful authentication, the Google Business data is synchronized with our business profile system, enabling users to manage their business presence from a single interface.

### 2. Compliance Checking System
The authenticated Google Business Profile allows our compliance system to run checks and provide optimization recommendations to ensure the business meets all requirements.

### 3. Notification System
Authentication events trigger notifications to keep users informed of their account status and any required actions.

### 4. Analytics System
Authentication metrics are tracked to provide insights on user behavior and system performance.

## Conclusion

The Google Business Profile authentication flow in Social Genius combines frontend UI, Next.js API routes, browser automation services, and Google authentication to create a seamless user experience. The implementation follows these key steps:

1. User opens the business profile modal from the dashboard
2. User enters business name and proceeds to the next step
3. User provides Google Business Profile credentials
4. Backend processes credentials through the browser-use-api service
5. Browser automation logs into Google Business Profile
6. Authentication result is returned to the frontend
7. Session data is stored for persistent access
8. Business data is synchronized with our database

The enhanced tracing and logging system implemented across all components provides:

1. **End-to-end traceability** with unique trace IDs propagating through all components
2. **Function-level context** with automatic entry/exit logging
3. **Performance measurement** for all critical operations
4. **Visual indicators** for different log categories and levels
5. **Standardized log format** for easier filtering and analysis
6. **Enhanced error handling** with detailed diagnostic information
7. **Environment-aware logging levels** configurable for different scenarios

This comprehensive approach to Google authentication makes it simpler for users to connect their business profiles, strengthens security through proper credential handling, and enables detailed monitoring and debugging across the distributed system. The trace ID-based tracking ensures that even in a complex, distributed system, requests can be tracked across all components and services, reducing the time to identify and fix issues while providing valuable performance insights.