import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth/middleware';
import { BrowserOperationService } from '@/lib/browser-automation/service-bridge';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * API endpoint to create a new Google Business Profile post
 * This integrates with the browser-use-api to create posts through browser automation
 */
export const POST = createAuthRoute(async (req: NextRequest, userId: number) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[BUSINESS_POST] ${timestamp} - Post creation request received`);
  console.log(`[BUSINESS_POST] ${timestamp} - User ID: ${userId}`);
  
  try {
    // Get request data
    const body = await req.json();
    const { 
      businessId, 
      text, 
      imageUrl, 
      buttonText, 
      buttonUrl, 
      sessionId 
    } = body;
    
    // Validate required parameters
    if (!businessId || !text) {
      console.error('[BUSINESS_POST] Missing required parameters for post creation');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: businessId or text' 
      }, { status: 400 });
    }
    
    console.log(`[BUSINESS_POST] ${timestamp} - Creating post for business: ${businessId}`);
    
    // Check text length - Google requires between 1-1500 characters for posts
    if (text.length < 1 || text.length > 1500) {
      console.error('[BUSINESS_POST] Text length must be between 1-1500 characters');
      return NextResponse.json({
        success: false,
        error: 'Text must be between 1-1500 characters',
        errorCode: 'INVALID_TEXT_LENGTH'
      }, { status: 400 });
    }
    
    // If button text is provided, button URL must also be provided (and vice versa)
    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      console.error('[BUSINESS_POST] If button text is provided, button URL must also be provided (and vice versa)');
      return NextResponse.json({
        success: false,
        error: 'If button text is provided, button URL must also be provided (and vice versa)',
        errorCode: 'INVALID_BUTTON_CONFIG'
      }, { status: 400 });
    }
    
    // Initialize the browser operation service
    console.log(`[BUSINESS_POST] ${timestamp} - Initializing browser operation service`);
    const browserOpService = BrowserOperationService.getInstance();
    
    // Check health to ensure the service is available
    const healthCheck = await browserOpService.checkHealth();
    
    if (!healthCheck.overallHealthy) {
      console.error('[BUSINESS_POST] Browser automation service is unhealthy');
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
    
    console.log(`[BUSINESS_POST] ${timestamp} - Creating post with content length: ${text.length} chars`);
    if (imageUrl) {
      console.log(`[BUSINESS_POST] ${timestamp} - Post includes image: ${imageUrl.substring(0, 50)}...`);
    }
    if (buttonText && buttonUrl) {
      console.log(`[BUSINESS_POST] ${timestamp} - Post includes button: ${buttonText} -> ${buttonUrl}`);
    }
    
    // Create post with browser automation service
    const postResult = await browserOpService.createBusinessPost(
      businessId,
      {
        text,
        imageUrl,
        buttonText,
        buttonUrl
      },
      headers,
      sessionId
    );
    
    // Log result based on success or failure
    if (postResult.status === 'success') {
      console.log(`[BUSINESS_POST] ${timestamp} - Post created successfully in ${Date.now() - startTime}ms`);
      
      // Return successful response
      return NextResponse.json({
        success: true,
        taskId: postResult.taskId,
        message: 'Post created successfully',
        screenshot: postResult.screenshot
      });
    } else {
      // Log failure details
      console.error(`[BUSINESS_POST] Post creation failed: ${postResult.error}`);
      
      // Return error response
      return NextResponse.json({
        success: false,
        taskId: postResult.taskId,
        error: postResult.error || 'Failed to create post',
        errorCode: 'POST_CREATION_FAILED',
        screenshot: postResult.screenshot
      }, { status: 500 });
    }
  } catch (error) {
    // Log unexpected errors
    console.error('Error creating business post:', error);
    
    // Return error response
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: 'SERVER_ERROR'
    }, { status: 500 });
  }
});

/**
 * API endpoint to get the status of a post creation task
 */
export const GET = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    // Get task ID from query parameters
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const businessId = url.searchParams.get('businessId');
    
    if (!taskId || !businessId) {
      console.error('[BUSINESS_POST] Missing required parameters for task status check');
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: taskId or businessId' 
      }, { status: 400 });
    }
    
    console.log(`[BUSINESS_POST] Checking status of task ${taskId} for business ${businessId}`);
    
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
    console.error('Error checking business post task status:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: 'SERVER_ERROR'
    }, { status: 500 });
  }
});
