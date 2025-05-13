import { NextRequest, NextResponse } from 'next/server';
import { BrowserAutomationService } from '@/lib/browser-automation';
import { AuthService } from '@/services/auth';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * API endpoint to handle Google authentication
 * This securely initiates a browser automation task to authenticate with Google
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication first
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
    
    // Verify that the session is valid
    const session = await authService.verifySession(sessionId);
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session' 
      }, { status: 401 });
    }
    
    // Get the request data
    const body = await req.json();
    const { businessId, email, password, options } = body;
    
    // Validate required parameters
    if (!businessId || !email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: businessId, email, or password' 
      }, { status: 400 });
    }
    
    // Extract the request ID from headers for tracing
    const requestId = req.headers.get('X-Request-ID') || `api-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Log the request with trace ID
    console.log(`[GoogleAuth:${requestId}] Authentication request for business ${businessId}, email ${email}`);
    
    // Prepare authentication options
    const authOptions = {
      reuseSession: options?.reuseSession !== false,
      persistSession: options?.persistSession !== false,
      debug: options?.debug === true,
      takeScreenshots: options?.takeScreenshots !== false,
      requestId
    };
    
    console.log(`[GoogleAuth:${requestId}] Authentication options:`, {
      ...authOptions,
      // Don't log any sensitive data
    });
    
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
    
    // Initiate the browser automation task
    const browserService = BrowserAutomationService.getInstance();
    console.log(`[GoogleAuth:${requestId}] Initiating browser automation with options:`, authOptions);
    
    const result = await browserService.authenticateGoogle(
      businessId, 
      email, 
      password, 
      {
        reuseSession: authOptions.reuseSession,
        persistSession: authOptions.persistSession,
        debug: authOptions.debug,
        takeScreenshots: authOptions.takeScreenshots
      }
    );
    
    // Store the credentials if authentication was successful
    if (result.status === 'success') {
      // Here we would typically store in a secure location, using encryption
      // For this implementation, we'll assume a method to store the credentials exists
      console.log(`[GoogleAuth:${requestId}] Authentication successful for business ID: ${businessId}`);
      
      // Check if we have screenshots to include in the response
      const screenshotInfo = result.screenshots?.length 
        ? `Captured ${result.screenshots.length} screenshots` 
        : 'No screenshots captured';
        
      console.log(`[GoogleAuth:${requestId}] ${screenshotInfo}`);
      
      // Return the successful result with screenshots if available
      return NextResponse.json({
        success: true,
        taskId: result.taskId,
        message: 'Authentication successful',
        status: result.status,
        traceId: result.traceId,
        screenshots: result.screenshots || [],
        duration: result.duration || 0
      });
    } else {
      // Log error details with trace ID
      console.error(`[GoogleAuth:${requestId}] Authentication failed:`, {
        error: result.error,
        status: result.status,
        traceId: result.traceId
      });
      
      // Return the failure result with screenshots if any were captured
      return NextResponse.json({
        success: false,
        taskId: result.taskId,
        error: result.error || 'Authentication failed',
        status: result.status,
        traceId: result.traceId,
        screenshots: result.screenshots || [],
        duration: result.duration || 0
      }, { status: 400 });
    }
  } catch (error) {
    // Ensure we have a request ID for error tracking
    const errorId = requestId || `error-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.error(`[GoogleAuth:${errorId}] Error in authentication:`, error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      traceId: errorId
    }, { status: 500 });
  }
}

/**
 * API endpoint to check status of a task
 */
export async function GET(req: NextRequest) {
  try {
    // Extract task ID from query parameters
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing taskId parameter' 
      }, { status: 400 });
    }
    
    // Extract request ID for tracing
    const requestId = req.headers.get('X-Request-ID') || `status-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[TaskStatus:${requestId}] Checking status for task ${taskId}`);
    
    // Check the task status
    const browserService = BrowserAutomationService.getInstance();
    const result = await browserService.checkTaskStatus(taskId);
    
    // Log result with screenshots if any
    const screenshotInfo = result.screenshots?.length 
      ? `Task has ${result.screenshots.length} screenshots available` 
      : 'No screenshots available';
    
    console.log(`[TaskStatus:${requestId}] Status: ${result.status}, ${screenshotInfo}`);
    
    return NextResponse.json({
      success: result.status !== 'failed',
      taskId: result.taskId,
      status: result.status,
      result: result.result,
      error: result.error,
      traceId: result.traceId,
      screenshots: result.screenshots || [],
      duration: result.duration || 0
    });
  } catch (error) {
    // Ensure we have a request ID for error tracking
    const errorId = requestId || `status-error-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.error(`[TaskStatus:${errorId}] Error checking task status:`, error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      traceId: errorId
    }, { status: 500 });
  }
}