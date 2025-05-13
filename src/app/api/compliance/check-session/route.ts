import { NextRequest, NextResponse } from 'next/server';
import { BrowserAutomationService } from '@/lib/browser-automation';
import { AuthService } from '@/services/auth';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Make sure route is always handled dynamically and never statically generated
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache this route

/**
 * API endpoint to check if a Google authentication session is still valid
 * This verifies if the browser session for a business is still active
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get the URL parameters
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    
    // Check if businessId is provided
    if (!businessId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing businessId parameter' 
      }, { status: 400 });
    }
    
    // Check authentication
    const authService = AuthService.getInstance();
    
    // Get session cookie
    const cookieHeader = req.headers.get('cookie');
    const cookies = authService.parseCookies(cookieHeader || '');
    const sessionId = cookies.session || cookies.sessionId;
    
    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Verify the session
    const session = await authService.verifySession(sessionId);
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session' 
      }, { status: 401 });
    }
    
    // Check if the user owns this business
    const userId = session.user.id;
    const userBusinesses = await authService.getBusinesses(userId);
    
    if (!userBusinesses.success || !userBusinesses.businesses) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to verify business ownership' 
      }, { status: 500 });
    }
    
    const businessExists = userBusinesses.businesses.some(b => b.businessId === businessId);
    if (!businessExists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business not found or not owned by this user' 
      }, { status: 403 });
    }
    
    // Get any additional session ID from the request
    const sessionIdParam = searchParams.get('sessionId');
    const xSessionId = req.headers.get('x-session-id');
    
    // Use the most reliable session ID source (prioritize headers, then params, then cookies)
    const browserSessionId = xSessionId || sessionIdParam || sessionId;
    
    console.log(`[API] Using session ID for browser-use-api: ${browserSessionId.substring(0, 8)}...`);
    
    // Connect to the browser automation service 
    const browser = BrowserAutomationService.getInstance();
    const isHealthy = await browser.checkHealth();
    
    // Check browser service first
    if (!isHealthy) {
      console.error(`[API] Browser service unhealthy when checking session for business ${businessId}`);
      return NextResponse.json({
        success: false,
        valid: false,
        error: 'Browser service unavailable',
        errorCode: 'BROWSER_SERVICE_UNAVAILABLE'
      });
    }
    
    console.log(`[API] Browser service healthy, checking session for business ${businessId}`);
    
    // First check if a session exists
    const sessionCheck = await browser.checkSession(businessId, browserSessionId);
    
    if (!sessionCheck.hasSession) {
      console.log(`[API] No browser session found for business ${businessId}`);
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'No browser session found',
        errorCode: 'NO_SESSION'
      });
    }
    
    // If session exists but is expired, report as invalid
    if (sessionCheck.isExpired) {
      console.log(`[API] Session for business ${businessId} exists but is expired`);
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'Session expired',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    // Validate the session with browser-use-api
    const validationResult = await browser.validateSession(businessId, browserSessionId);
    const isValid = validationResult.valid;
    
    // If we found a valid session
    const responseTime = Date.now() - startTime;
    
    console.log(`[API] Session check for business ${businessId}: ${isValid ? 'Valid' : 'Invalid'} (${responseTime}ms)`);
    
    return NextResponse.json({
      success: true,
      valid: isValid,
      responseTime
    });
    
  } catch (error) {
    console.error('Error checking session:', error);
    
    return NextResponse.json({ 
      success: false, 
      valid: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: 'SERVER_ERROR'
    }, { status: 500 });
  }
}