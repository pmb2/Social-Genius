import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';
import { ComplianceAuthService } from '@/services/compliance/consolidated-auth-service';
import { logBrowserOperation, LogLevel, OperationCategory } from '@/lib/utilities/browser-logging';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Make sure route is always handled dynamically and never statically generated
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache this route

/**
 * API endpoint to check the status of a browser automation task
 * This provides status updates for ongoing Google authentication processes
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
    
    // Initialize consolidated auth service for status checking
    console.log(`[TASK_STATUS] Initializing consolidated compliance auth service for task ${taskId}`);
    const complianceService = new ComplianceAuthService();
    
    // Generate a trace ID for tracking this request
    const traceId = `status-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    logBrowserOperation(
      OperationCategory.TASK,
      `Checking status for task ${taskId}`,
      LogLevel.INFO,
      { sessionId: sessionId.substring(0, 8) + '...', traceId }
    );
    
    // Get task status from the task manager
    let taskStatus;
    
    // First try to check browser instances in the consolidated service
    // If no instance found, fall back to browser-use-api via browserAutomation
    const debugInfo = complianceService.getDebugInfo();
    
    console.log(`[TASK_STATUS] Current browser instances: ${debugInfo.instanceCount}`);
    
    // Log current browser instances for debugging
    debugInfo.instances.forEach((instance, idx) => {
      console.log(`[TASK_STATUS] Browser instance ${idx + 1}: ID=${instance.key}, business=${instance.businessId}, status=${instance.status}`);
    });
    
    // Use the browser automation service directly for checking status
    const browserAutomation = complianceService.getBrowserAutomation();
    taskStatus = await browserAutomation.checkTaskStatus(taskId);
    
    // Check if business belongs to user - security check to prevent task ID enumeration
    // In a real implementation, we would check that the task's businessId belongs to the user
    // For now, we'll assume the task is valid for the user if we can retrieve it
    
    // Check the task status
    if (taskStatus.status === 'success') {
      // Return successful task status with screenshot if available
      let screenshotUrl = null;
      
      if (taskStatus.screenshot) {
        // In a real implementation, the screenshot might be Base64 encoded or a file path
        // For now, we'll just pass through the screenshot data
        screenshotUrl = taskStatus.screenshot;
      }
      
      // Log successful task completion
      console.log(`[API] Task ${taskId} completed successfully for business ${taskStatus.businessId}`);
      
      return NextResponse.json({
        success: true,
        status: 'success',
        taskId: taskStatus.taskId,
        businessId: taskStatus.businessId,
        screenshot: screenshotUrl,
        message: 'Authentication task completed successfully'
      });
      
    } else if (taskStatus.status === 'failed') {
      // Return failure information with error details and screenshot if available
      let screenshotUrl = null;
      let errorCode = 'AUTH_FAILED';
      
      // Extract error code from error message if available
      if (taskStatus.error) {
        if (taskStatus.error.includes('WRONG_PASSWORD')) errorCode = 'WRONG_PASSWORD';
        else if (taskStatus.error.includes('ACCOUNT_LOCKED')) errorCode = 'ACCOUNT_LOCKED';
        else if (taskStatus.error.includes('SUSPICIOUS')) errorCode = 'SUSPICIOUS_ACTIVITY';
        else if (taskStatus.error.includes('VERIFY')) errorCode = 'VERIFICATION_REQUIRED';
        else if (taskStatus.error.includes('TWO_FACTOR') || taskStatus.error.includes('2FA')) errorCode = 'TWO_FACTOR_REQUIRED';
      }
      
      // Try to get screenshot
      if (taskStatus.screenshot) {
        screenshotUrl = taskStatus.screenshot;
      } else {
        // Try to fetch screenshot directly using the unified service
        try {
          const browserOpService = browserAutomation;
          screenshotUrl = await browserOpService.getScreenshot(taskId, taskStatus.businessId);
        } catch (screenshotError) {
          console.error(`[API] Failed to fetch screenshot for failed task ${taskId}:`, screenshotError);
        }
      }
      
      console.log(`[API] Task ${taskId} failed with error: ${taskStatus.error}`);
      
      return NextResponse.json({
        success: false,
        status: 'failed',
        taskId: taskStatus.taskId,
        businessId: taskStatus.businessId,
        error: taskStatus.error || 'Authentication failed',
        errorCode,
        screenshot: screenshotUrl
      });
      
    } else if (taskStatus.status === 'in_progress') {
      // For tasks in progress, estimate completion percentage
      // This is just an estimate since we don't have real progress data
      
      // Get task creation time from taskId prefix if available
      // For real implementation, we would track this in the database
      let progress = 25; // Default progress
      
      // Extract time component for better progress estimate
      // In a real implementation, we would have actual progress tracking
      try {
        const taskCreationTime = parseInt(taskStatus.taskId.split('-')[0], 10);
        if (!isNaN(taskCreationTime)) {
          // If task has been running for more than 10 seconds, increase progress
          const elapsedTime = Date.now() - taskCreationTime;
          // Every second after the first 5, add 5% progress, up to 85%
          if (elapsedTime > 5000) {
            const additionalProgress = Math.min(Math.floor((elapsedTime - 5000) / 1000) * 5, 60);
            progress = 25 + additionalProgress;
          }
        }
      } catch (e) {
        // If parsing fails, keep default progress
      }
      
      return NextResponse.json({
        success: true,
        status: 'in_progress',
        taskId: taskStatus.taskId,
        businessId: taskStatus.businessId,
        progress,
        message: 'Authentication in progress'
      });
      
    } else {
      // Unknown status
      return NextResponse.json({
        success: false,
        status: 'unknown',
        taskId: taskStatus.taskId,
        businessId: taskStatus.businessId,
        error: 'Unknown task status',
        errorCode: 'UNKNOWN_STATUS'
      });
    }
    
  } catch (error) {
    console.error('Error checking task status:', error);
    
    return NextResponse.json({ 
      success: false, 
      status: 'error',
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: 'SERVER_ERROR'
    }, { status: 500 });
  }
}