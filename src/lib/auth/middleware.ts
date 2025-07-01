import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';
import { 
  logBrowserOperation, 
  LogLevel, 
  OperationCategory,
  generateTraceId,
  createFunctionContext 
} from '@/lib/utilities/browser-logging';

// Middleware to authenticate requests
export async function authMiddleware(
  req: NextRequest,
  handler: (req: NextRequest, userId: number | string | undefined) => Promise<NextResponse>,
  options?: { bypassAuth?: boolean } // Add options for bypassing auth
): Promise<NextResponse> {
  // Generate a unique trace ID for this authentication request
  const traceId = generateTraceId('auth-mid');
  
  // Create a function context for enhanced logging
  const { log, logEntry, logExit } = createFunctionContext(
    'authMiddleware',
    '/src/lib/auth/middleware.ts',
    OperationCategory.AUTH,
    'auth-middleware',
    traceId
  );
  
  // Add special handling for errors
  process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled Rejection at: ${promise}`, LogLevel.ERROR, {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : 'No stack trace'
    });
  });
  
  // Log entry with basic request info
  logEntry({
    method: req.method,
    url: req.nextUrl.pathname,
    timestamp: new Date().toISOString()
  });
  
  const authService = AuthService.getInstance();
  
  // Get all cookies from the request (with enhanced safety check)
  // Use multiple safety checks to handle all edge cases
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
  
  const cookieHeader = req.headers.get('cookie') || '';
  
  log(`Request cookies summary`, LogLevel.INFO, {
    cookieCount: allCookies.length,
    cookieNames: allCookies.map(c => c.name),
    hasHeaderCookies: cookieHeader.length > 0,
    cookieHeaderLength: cookieHeader.length
  });
  
  // Try multiple ways to get session ID
  let sessionId = null;
  
  // Method 1: Use NextRequest.cookies API with enhanced safety check
  // Add extra null/undefined checks to handle edge cases
  let sessionCookie = null;
  let sessionIdCookie = null;
  
  try {
    if (req.cookies && typeof req.cookies.get === 'function') {
      sessionCookie = req.cookies.get('session');
      sessionIdCookie = req.cookies.get('sessionId');
    }
  } catch (getCookieError) {
    log(`Error accessing individual cookies`, LogLevel.ERROR, {
      error: getCookieError instanceof Error ? getCookieError.message : String(getCookieError)
    });
  }
  
  // Check if we have session cookie values
  const cookieSessionValue = sessionCookie?.value;
  const cookieSessionIdValue = sessionIdCookie?.value;
  
  // Assign sessionId from either cookie
  sessionId = cookieSessionValue || cookieSessionIdValue;
  
  if (sessionId) {
    log(`Found session via cookies API: ${sessionId.substring(0, 8)}...`, LogLevel.INFO);
  }
  
  // Method 2: If that fails, try parsing cookie header directly
  if (!sessionId && cookieHeader) {
    try {
      const parsedCookies = authService.parseCookies(cookieHeader);
      sessionId = parsedCookies['session'] || parsedCookies['sessionId'];
      
      if (sessionId) {
        log(`Found session via cookie header: ${sessionId.substring(0, 8)}...`, LogLevel.INFO);
      }
    } catch (parseError) {
      log(`Error parsing cookie header`, LogLevel.ERROR, {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
    }
  }
  
  // Method 3: As a last resort, check all cookies
  if (!sessionId) {
    for (const cookie of allCookies) {
      if (cookie.name === 'session' || cookie.name === 'sessionId') {
        sessionId = cookie.value;
        log(`Found session via cookie iteration: ${sessionId.substring(0, 8)}...`, LogLevel.INFO);
        break;
      }
    }
  }
  
  // Method 4: Check for session in authorization header (for API clients)
  if (!sessionId) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.length > 10) { // Basic validation for token format
        sessionId = token;
        log(`Using token from Authorization header: ${sessionId.substring(0, 8)}...`, LogLevel.INFO);
      }
    }
  }
  
  // Method 5: Check for X-Session-ID header (for browser-use-api)
  if (!sessionId) {
    const sessionHeader = req.headers.get('x-session-id');
    if (sessionHeader && sessionHeader.length > 10) {
      sessionId = sessionHeader;
      log(`Using session from X-Session-ID header: ${sessionId.substring(0, 8)}...`, LogLevel.INFO);
    }
  }
  
  // Check for XMLHttpRequest header to identify AJAX requests
  const isAjaxRequest = req.headers.get('X-Requested-With') === 'XMLHttpRequest';
  
  // Log all auth details for debugging the session issue
  // Reuse the previously defined cookie values to maintain consistency
  // This avoids potential issues with different access methods returning different values
  
  // Check if auth bypass is enabled - needed for Google auth process
  if (options?.bypassAuth) {
    log(`Auth bypass enabled - Proceeding without authentication for ${req.nextUrl.pathname}`, LogLevel.WARN);
    
    // Create a temporary user session
    const tempUserId = 1; // Default to user ID 1 (you might want to adjust this)
    
    try {
      // Create a new headers object that's mutable
      const headers = new Headers(req.headers);
      headers.set('X-Test-Mode', 'true');
      headers.set('X-Temp-User-ID', String(tempUserId));
      headers.set('X-Trace-ID', traceId);
      headers.set('X-Mock-User-ID', String(tempUserId));
      headers.set('X-Mock-User-Email', 'test@example.com');
      
      try {
        // Modify the original request headers instead of creating a new request object
        // This avoids potential issues with the body or other request properties
        for (const [key, value] of headers.entries()) {
          req.headers.set(key, value);
        }
        
        // Add traceId as a custom property
        // @ts-expect-error - Adding a custom property to the request
        req.traceId = traceId;
        
        log(`Auth bypass: Proceeding to handler with temporary user ID ${tempUserId}`, LogLevel.WARN);
        
        // Call the handler with the temporary user ID using the original request
        const handlerResponse = await handler(req, tempUserId);
        
        // Ensure trace ID is passed along
        handlerResponse.headers.set('X-Trace-ID', traceId);
        
        logExit({
          status: handlerResponse.status,
          success: true,
          userId: tempUserId,
          bypassUsed: true
        });
        
        return handlerResponse;
      } catch (error) {
        log(`Error in bypassed auth handler`, LogLevel.ERROR, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack available'
        });
        
        const response = NextResponse.json({
          success: false,
          error: 'Internal server error in bypassed auth',
          traceId,
          timestamp: new Date().toISOString()
        }, { status: 500 });
        
        logExit({
          status: 500,
          success: false,
          reason: 'Handler error in bypassed auth'
        }, error);
        
        return response;
      }
    } catch (outerError) {
      // Handle any outer errors
      log(`Fatal error in auth bypass handler`, LogLevel.ERROR, {
        error: outerError instanceof Error ? outerError.message : String(outerError),
        stack: outerError instanceof Error ? outerError.stack : 'No stack available'
      });
      
      return NextResponse.json({
        success: false,
        error: 'Fatal error in auth bypass',
        traceId
      }, { status: 500 });
    }
  }
  
  // Determine session source (with safe access)
  let sessionIdSource = 'None';
  if (sessionId) {
    if (cookieSessionValue) {
      sessionIdSource = 'Cookie API (session)';
    } else if (cookieSessionIdValue) {
      sessionIdSource = 'Cookie API (sessionId)';
    } else if (cookieHeader) {
      try {
        const parsedCookies = authService.parseCookies(cookieHeader);
        if (parsedCookies['session'] || parsedCookies['sessionId']) {
          sessionIdSource = 'Cookie Header Parse';
        }
      } catch (e) {
        // Ignore error, will use default
      }
    }
    
    if (sessionIdSource === 'None') {
      if (req.headers.get('authorization')) {
        sessionIdSource = 'Authorization Header';
      } else if (req.headers.get('x-session-id')) {
        sessionIdSource = 'X-Session-ID Header';
      } else {
        sessionIdSource = 'Cookie Iteration';
      }
    }
  }
  
  log(`Auth middleware request details`, LogLevel.INFO, {
    path: req.nextUrl.pathname,
    method: req.method,
    sessionCookie: cookieSessionValue ? 'Present' : 'Missing',
    sessionIdCookie: cookieSessionIdValue ? 'Present' : 'Missing',
    cookieHeaderPresent: !!cookieHeader,
    cookieHeaderLength: cookieHeader ? cookieHeader.length : 0,
    sessionIdFound: !!sessionId,
    sessionIdSource,
    sessionIdPrefix: sessionId ? sessionId.substring(0, 8) + '...' : 'None',
    sessionIdLength: sessionId ? sessionId.length : 0,
    isAjaxRequest: isAjaxRequest ? 'Yes' : 'No',
    cookieNames: allCookies.map(c => c.name),
    referer: req.headers.get('referer') || 'None',
    origin: req.headers.get('origin') || 'None',
    userAgent: req.headers.get('user-agent')?.substring(0, 50) || 'None',
    contentType: req.headers.get('content-type') || 'None'
  });
  
  // No session found in any source
  if (!sessionId) {
    log(`No session cookie found before API call, attempting to recover`, LogLevel.ERROR);
    
    // Add extended debugging when session is missing
    const headers = Object.fromEntries(req.headers.entries());
    const headerKeys = Object.keys(headers);
    
    log(`Request details for session recovery`, LogLevel.ERROR, {
      url: req.nextUrl.pathname,
      method: req.method,
      headerCount: headerKeys.length,
      cookieHeader: headers.cookie ? 'Present' : 'Not present',
      cookieHeaderLength: headers.cookie?.length || 0,
      referer: headers.referer || 'Not present',
      origin: headers.origin || 'Not present',
      contentType: headers['content-type'] || 'Not present',
      userAgent: headers['user-agent']?.substring(0, 50) || 'Not present',
      acceptHeader: headers.accept || 'Not present'
    });
    
    // Look for session in cookies directly to handle edge cases
    let sessionFromCookieHeader = null;
    let recoveredSession = null;
    
    if (headers.cookie) {
      try {
        const sessionCookieMatch = headers.cookie.match(/session=([^;]+)/);
        const sessionIdCookieMatch = headers.cookie.match(/sessionId=([^;]+)/);
        
        if (sessionCookieMatch || sessionIdCookieMatch) {
          sessionFromCookieHeader = sessionCookieMatch?.[1] || sessionIdCookieMatch?.[1];
          log(`Found session cookie directly in header: ${sessionFromCookieHeader.substring(0, 8)}...`, LogLevel.INFO);
          
          // Try to use this session ID
          try {
            const sessionData = await authService.verifySession(sessionFromCookieHeader, traceId);
            
            if (sessionData) {
              log(`Recovered session is valid for user ${sessionData.user_id}`, LogLevel.INFO, {
                userId: sessionData.user_id,
                email: sessionData.user_email || 'unknown'
              });
              
              // If valid, use this session!
              sessionId = sessionFromCookieHeader;
              recoveredSession = sessionData;
            } else {
              log(`Recovered session is not valid`, LogLevel.WARN);
            }
          } catch (error) {
            log(`Error verifying recovered session`, LogLevel.ERROR, {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : 'No stack available'
            });
          }
        } else {
          log(`No session cookie found in header after regexp matching`, LogLevel.ERROR, {
            cookieHeader: headers.cookie.length > 200 ? 
              `${headers.cookie.substring(0, 100)}...${headers.cookie.substring(headers.cookie.length - 100)}` : 
              headers.cookie
          });
        }
      } catch (recoveryError) {
        log(`Error during header-based session recovery`, LogLevel.ERROR, {
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          stack: recoveryError instanceof Error ? recoveryError.stack : 'No stack available'
        });
      }
    }
    
    // If no valid session could be found after recovery attempt, return 401
    if (!sessionId) {
      const responseData = {
        success: false,
        error: 'Authentication required - No session cookie found',
        fix: 'Please ensure cookies are enabled in your browser',
        traceId,
        context: {
          url: req.nextUrl.pathname,
          cookieHeaderPresent: !!headers.cookie,
          cookieHeaderLength: headers.cookie?.length || 0,
          recoveryAttempted: !!sessionFromCookieHeader,
          timestamp: new Date().toISOString()
        }
      };
      
      log(`Authentication failed - returning 401 response`, LogLevel.WARN, {
        path: req.nextUrl.pathname,
        recoveryAttempted: !!sessionFromCookieHeader
      });
      
      // Return proper JSON response with CORS headers for AJAX requests
      const response = NextResponse.json(responseData, { status: 401 });
      
      // Add CORS headers for AJAX requests
      if (isAjaxRequest) {
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
      
      logExit({
        status: 401,
        success: false,
        reason: 'No valid session',
        recoveryAttempted: !!sessionFromCookieHeader
      });
      
      return response;
    }
  }
  
  // Verify session with detailed logging and tracing
  log(`Verifying session ID: ${sessionId.substring(0, 8)}...`, LogLevel.INFO);
  
  let session;
  try {
    const sessionStartTime = Date.now();
    session = await authService.verifySession(sessionId, traceId);
    const sessionVerifyTime = Date.now() - sessionStartTime;
    
    // Log detailed session verification result with timing
    if (session) {
      log(`Session verification successful (${sessionVerifyTime}ms)`, LogLevel.INFO, {
        userId: session.user_id,
        email: session.user_email || 'unknown',
        verifyTime: sessionVerifyTime
      });
    } else {
      log(`Session verification failed (${sessionVerifyTime}ms) - Session not found or expired`, LogLevel.ERROR, {
        sessionIdPrefix: sessionId.substring(0, 8) + '...',
        verifyTime: sessionVerifyTime
      });
    }
  } catch (sessionError) {
    log(`Session verification error`, LogLevel.ERROR, {
      error: sessionError instanceof Error ? sessionError.message : String(sessionError),
      stack: sessionError instanceof Error ? sessionError.stack : 'No stack available'
    });
    
    const response = NextResponse.json({
      success: false,
      error: 'Session verification error',
      traceId
    }, { status: 401 });
    
    logExit({
      status: 401,
      success: false,
      reason: 'Session verification error'
    }, sessionError);
    
    return response;
  }
  
  if (!session) {
    // Return proper JSON response for invalid session with trace ID
    log(`Returning unauthorized response - invalid session`, LogLevel.WARN);
    
    const response = NextResponse.json({
      success: false,
      error: 'Invalid or expired session',
      traceId,
      timestamp: new Date().toISOString()
    }, { status: 401 });
    
    logExit({
      status: 401,
      success: false,
      reason: 'Invalid or expired session'
    });
    
    return response;
  }
  
  try {
    // Don't clone the request - work with the original request directly
    // @ts-expect-error - Adding a custom property to the request
    req.traceId = traceId;
    
    log(`Authentication successful, proceeding to handler`, LogLevel.INFO, {
      userId: session.user_id,
      email: session.user_email || 'unknown'
    });
    
    // Convert user_id to a number to ensure consistent type
    const userId = typeof session.user_id === 'string' ? parseInt(session.user_id, 10) : session.user_id;
    
    // Add user ID directly to the original request's headers
    req.headers.set('X-User-ID', String(userId));
    
    try {
      // Pass the userId directly to the handler instead of creating a new request object
      // This avoids potential issues with the body or other request properties
      log(`Calling handler with userId: ${userId}, type: ${typeof userId}`, LogLevel.INFO);
      
      // We're working directly with the original request, which already has the traceId and X-User-ID header
      
      // Call the handler with the original request and the userId
      const handlerResponse = await handler(req, userId);
      
      logExit({
        status: handlerResponse.status,
        success: true,
        userId: userId
      });
      
      return handlerResponse;
    } catch (proxyError) {
      log(`Error creating request for handler: ${proxyError instanceof Error ? proxyError.message : String(proxyError)}`, LogLevel.ERROR);
      
      // Fallback approach: call handler directly with original request
      log(`Falling back to direct handler call with userId: ${userId}`, LogLevel.WARN);
      try {
        const directResponse = await handler(req, userId);
        
        logExit({
          status: directResponse.status,
          success: true,
          userId: userId,
          fallback: true
        });
        
        return directResponse;
      } catch (directError) {
        log(`Error in fallback handler call: ${directError instanceof Error ? directError.message : String(directError)}`, LogLevel.ERROR);
        
        logExit({
          status: 500,
          success: false,
          error: directError
        });
        
        return NextResponse.json({
          success: false,
          error: 'Failed to process request',
          traceId
        }, { status: 500 });
      }
    }
  } catch (error) {
    log(`Error in authenticated handler`, LogLevel.ERROR, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available'
    });
    
    const response = NextResponse.json({
      success: false,
      error: 'Internal server error',
      traceId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
    logExit({
      status: 500,
      success: false,
      reason: 'Handler error'
    }, error);
    
    return response;
  }
}

// Helper function to create an authenticated API route
// Helper function for withAuth pattern
export function withAuth(handler: (req: NextRequest, userId?: number) => Promise<NextResponse>) {
  return createAuthRoute(handler);
}

export function createAuthRoute(
  handler: (req: NextRequest, userId: number | string | undefined) => Promise<NextResponse>,
  options?: { bypassAuth?: boolean } // Add options for bypassing auth
) {
  return async function(req: NextRequest) {
    try {
      return await authMiddleware(req, handler, options);
    } catch (error) {
      // Generate a trace ID for this error
      const errorTraceId = generateTraceId('auth-error');
      
      // Log the error with our enhanced logging
      logBrowserOperation(
        OperationCategory.AUTH,
        `Unhandled error in auth route for ${req.method} ${req.nextUrl.pathname}`,
        LogLevel.ERROR,
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack available'
        },
        errorTraceId
      );
      
      // Return a proper error response with trace ID
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : String(error),
        traceId: errorTraceId,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };
}