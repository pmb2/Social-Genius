import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';

// Middleware to authenticate requests
export async function authMiddleware(
  req: NextRequest,
  handler: (req: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  const authService = AuthService.getInstance();
  
  // Get all cookies from the request
  const allCookies = Array.from(req.cookies.getAll());
  const cookieHeader = req.headers.get('cookie');
  
  // Try multiple ways to get session ID
  let sessionId = null;
  
  // Method 1: Use NextRequest.cookies API
  sessionId = req.cookies.get('session')?.value || req.cookies.get('sessionId')?.value;
  
  // Method 2: If that fails, try parsing cookie header directly
  if (!sessionId && cookieHeader) {
    const parsedCookies = authService.parseCookies(cookieHeader);
    sessionId = parsedCookies['session'] || parsedCookies['sessionId'];
  }
  
  // Method 3: As a last resort, check all cookies
  if (!sessionId) {
    for (const cookie of allCookies) {
      if (cookie.name === 'session' || cookie.name === 'sessionId') {
        sessionId = cookie.value;
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
        console.log(`Auth middleware - Using token from Authorization header: ${sessionId.substring(0, 8)}...`);
      }
    }
  }
  
  // Method 5: Check for X-Session-ID header (for browser-use-api)
  if (!sessionId) {
    const sessionHeader = req.headers.get('x-session-id');
    if (sessionHeader && sessionHeader.length > 10) {
      sessionId = sessionHeader;
      console.log(`Auth middleware - Using session from X-Session-ID header: ${sessionId.substring(0, 8)}...`);
    }
  }
  
  // Check for XMLHttpRequest header to identify AJAX requests
  const isAjaxRequest = req.headers.get('X-Requested-With') === 'XMLHttpRequest';
  
  // Log all auth details for debugging the session issue
  console.log(`Auth middleware request: ${req.method} ${req.nextUrl.pathname}`, {
    sessionCookie: req.cookies.get('session')?.value ? 'Present' : 'Missing',
    sessionIdCookie: req.cookies.get('sessionId')?.value ? 'Present' : 'Missing',
    cookieHeaderPresent: !!cookieHeader,
    cookieHeaderLength: cookieHeader ? cookieHeader.length : 0,
    sessionIdFound: !!sessionId,
    sessionIdSource: !sessionId ? 'None' : 
                    req.cookies.get('session')?.value ? 'Cookie API (session)' :
                    req.cookies.get('sessionId')?.value ? 'Cookie API (sessionId)' :
                    cookieHeader && (authService.parseCookies(cookieHeader)['session'] || 
                                   authService.parseCookies(cookieHeader)['sessionId']) ? 'Cookie Header Parse' :
                    req.headers.get('authorization') ? 'Authorization Header' :
                    req.headers.get('x-session-id') ? 'X-Session-ID Header' : 'Cookie Iteration',
    sessionIdPrefix: sessionId ? sessionId.substring(0, 8) + '...' : 'None',
    sessionIdLength: sessionId ? sessionId.length : 0,
    isAjaxRequest: isAjaxRequest ? 'Yes' : 'No',
    cookieNames: allCookies.map(c => c.name),
    referer: req.headers.get('referer') || 'None',
    origin: req.headers.get('origin') || 'None',
    userAgent: req.headers.get('user-agent') || 'None',
    contentType: req.headers.get('content-type') || 'None'
  });
  
  // No session found in any source
  if (!sessionId) {
    // Return proper JSON response with CORS headers for AJAX requests
    const response = NextResponse.json({
      success: false,
      error: 'Authentication required - No session cookie found',
      fix: 'Please ensure cookies are enabled in your browser'
    }, { status: 401 });
    
    // Add CORS headers for AJAX requests
    if (isAjaxRequest) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return response;
  }
  
  // Verify session
  console.log(`Auth middleware - Attempting to verify session for ID: ${sessionId.substring(0, 8)}...`);
  
  let session;
  try {
    session = await authService.verifySession(sessionId);
    
    // Only log detailed session info for non-API requests
    if (!req.nextUrl.pathname.includes('/api/')) {
      console.log(`Auth middleware - Session verification result:`, 
        session ? `Valid session for user ${session.user_id}` : 'Invalid session');
    }
  } catch (sessionError) {
    console.error('Session verification error:', sessionError);
    return NextResponse.json({
      success: false,
      error: 'Session verification error'
    }, { status: 401 });
  }
  
  if (!session) {
    // Return proper JSON response for invalid session
    return NextResponse.json({
      success: false,
      error: 'Invalid or expired session'
    }, { status: 401 });
  }
  
  try {
    // Call the handler with the authenticated user ID
    return handler(req, session.user_id);
  } catch (error) {
    console.error('Error in authenticated handler:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to create an authenticated API route
export function createAuthRoute(
  handler: (req: NextRequest, userId: number) => Promise<NextResponse>
) {
  return async function(req: NextRequest) {
    try {
      return await authMiddleware(req, handler);
    } catch (error) {
      console.error('Error in auth route:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };
}