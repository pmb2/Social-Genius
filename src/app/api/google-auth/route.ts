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
    const { businessId, email, password } = body;
    
    // Validate required parameters
    if (!businessId || !email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: businessId, email, or password' 
      }, { status: 400 });
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
    
    // Initiate the browser automation task
    const browserService = BrowserAutomationService.getInstance();
    const result = await browserService.authenticateGoogle(businessId, email, password);
    
    // Store the credentials if authentication was successful
    if (result.status === 'success') {
      // Here we would typically store in a secure location, using encryption
      // For this implementation, we'll assume a method to store the credentials exists
      console.log('Authentication successful for business ID:', businessId);
      
      // Return the successful result
      return NextResponse.json({
        success: true,
        taskId: result.taskId,
        message: 'Authentication successful',
        status: result.status
      });
    } else {
      // Return the failure result
      return NextResponse.json({
        success: false,
        taskId: result.taskId,
        error: result.error || 'Authentication failed',
        status: result.status
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in Google authentication:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
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
    
    // Check the task status
    const browserService = BrowserAutomationService.getInstance();
    const result = await browserService.checkTaskStatus(taskId);
    
    return NextResponse.json({
      success: result.status !== 'failed',
      taskId: result.taskId,
      status: result.status,
      result: result.result,
      error: result.error
    });
  } catch (error) {
    console.error('Error checking task status:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }, { status: 500 });
  }
}