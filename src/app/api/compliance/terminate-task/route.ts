import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Make sure route is always handled dynamically and never statically generated
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache this route

/**
 * API endpoint to terminate an ongoing browser automation task
 * This allows cancelling an authentication process that might be stuck or no longer needed
 */
export async function GET(req: NextRequest) {
  try {
    // Get the URL parameters
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    
    // Check if taskId is provided
    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing taskId parameter' 
      }, { status: 400 });
    }
    
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
    
    // For production, we would verify the task belongs to the user
    // For now, just attempt to terminate the task
    
    // In a real implementation, this would call the browser API to terminate the task
    // For now, we'll log the request and return a success response
    console.log(`[API] Request to terminate task ${taskId}`);
    
    // Import the BrowserOperationService for unified browser operations
    const { BrowserOperationService } = await import('@/lib/browser-automation/service-bridge');
    const browserOpService = BrowserOperationService.getInstance();
    
    try {
      // Attempt to terminate the task using the unified service
      const terminationResult = await browserOpService.terminateTask(taskId);
      
      return NextResponse.json({
        success: true,
        terminated: terminationResult.success,
        message: terminationResult.message || 'Task termination request processed',
        details: terminationResult.details
      });
    } catch (terminateError) {
      console.error(`[API] Error terminating task ${taskId}:`, terminateError);
      return NextResponse.json({
        success: false,
        error: terminateError instanceof Error ? terminateError.message : 'Failed to terminate task',
        errorCode: 'TERMINATE_FAILED'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error terminating task:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }, { status: 500 });
  }
}