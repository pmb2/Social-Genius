import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth/middleware';
import { BrowserOperationService } from '@/lib/browser-automation/service-bridge';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * API endpoint to update Google Business Profile information
 * This integrates with the browser-use-api to update profile through browser automation
 */
export const POST = createAuthRoute(async (req: NextRequest, userId: number) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[BUSINESS_PROFILE] ${timestamp} - Profile update request received`);
  console.log(`[BUSINESS_PROFILE] ${timestamp} - User ID: ${userId}`);
  
  try {
    // Get request data
    const body = await req.json();
    const { 
      businessId, 
      updates,
      sessionId
    } = body;
    
    // Validate required parameters
    if (!businessId || !updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      console.error('[BUSINESS_PROFILE] Missing or invalid required parameters for profile update');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing or invalid required parameters: businessId or updates' 
      }, { status: 400 });
    }
    
    console.log(`[BUSINESS_PROFILE] ${timestamp} - Updating profile for business: ${businessId}`);
    console.log(`[BUSINESS_PROFILE] ${timestamp} - Fields to update: ${Object.keys(updates).join(', ')}`);
    
    // Initialize the browser operation service
    console.log(`[BUSINESS_PROFILE] ${timestamp} - Initializing browser operation service`);
    const browserOpService = BrowserOperationService.getInstance();
    
    // Check health to ensure the service is available
    const healthCheck = await browserOpService.checkHealth();
    
    if (!healthCheck.overallHealthy) {
      console.error('[BUSINESS_PROFILE] Browser automation service is unhealthy');
      return NextResponse.json({
        success: false,
        error: 'Browser automation service is currently unavailable',
        errorCode: 'BROWSER_SERVICE_UNAVAILABLE',
        details: healthCheck
      }, { status: 503 });
    }
    
    // Extract headers for browser service
    const headers = {
      'X-Session-ID': sessionId || req.headers.get('X-Session-ID') || '',
      'Cookie': req.headers.get('cookie') || ''
    };
    
    // Update profile with browser automation service
    const updateResult = await browserOpService.updateBusinessProfile(
      businessId,
      updates,
      headers,
      sessionId
    );
    
    // Log result based on success or failure
    if (updateResult.status === 'success') {
      console.log(`[BUSINESS_PROFILE] ${timestamp} - Profile updated successfully in ${Date.now() - startTime}ms`);
      
      // Return successful response
      return NextResponse.json({
        success: true,
        taskId: updateResult.taskId,
        message: 'Profile updated successfully',
        updatedFields: Object.keys(updates),
        screenshot: updateResult.screenshot
      });
    } else {
      // Log failure details
      console.error(`[BUSINESS_PROFILE] Profile update failed: ${updateResult.error}`);
      
      // Return error response
      return NextResponse.json({
        success: false,
        taskId: updateResult.taskId,
        error: updateResult.error || 'Failed to update profile',
        errorCode: 'PROFILE_UPDATE_FAILED',
        screenshot: updateResult.screenshot
      }, { status: 500 });
    }
  } catch (error) {
    // Log unexpected errors
    console.error('Error updating business profile:', error);
    
    // Return error response
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: 'SERVER_ERROR'
    }, { status: 500 });
  }
});

/**
 * API endpoint to get the status of a profile update task
 */
export const GET = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    // Get task ID from query parameters
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const businessId = url.searchParams.get('businessId');
    
    if (!taskId || !businessId) {
      console.error('[BUSINESS_PROFILE] Missing required parameters for task status check');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: taskId or businessId' 
      }, { status: 400 });
    }
    
    console.log(`[BUSINESS_PROFILE] Checking status of task ${taskId} for business ${businessId}`);
    
    // Initialize the browser operation service
    const browserOpService = BrowserOperationService.getInstance();
    
    // Check task status
    const taskResult = await browserOpService.checkTaskStatus(taskId);
    
    // Return task status
    return NextResponse.json({
      success: true,
      taskId: taskResult.taskId,
      status: taskResult.status,
      result: taskResult.result,
      error: taskResult.error,
      screenshot: taskResult.screenshot
    });
  } catch (error) {
    console.error('Error checking business profile task status:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: 'SERVER_ERROR'
    }, { status: 500 });
  }
});
