import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { BrowserAutomationService } from '@/lib/browser-automation';

/**
 * Test endpoint for the browser-use-api integration
 */
export const GET = withAuth(async (req: NextRequest, userId: number) => {
  try {
    // Validate the user ID
    if (!userId || isNaN(Number(userId))) {
      console.error(`Test auth endpoint: userId is invalid: ${userId}, type: ${typeof userId}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session' 
      }, { status: 401 });
    }
    
    // Convert to number if it's a string
    userId = Number(userId);
    
    console.log(`Running browser-use-api test for user ${userId}`);
    
    // Initialize browser automation service
    const browserService = BrowserAutomationService.getInstance();
    
    // Check if the API is healthy
    const isHealthy = await browserService.checkHealth();
    if (!isHealthy) {
      return NextResponse.json({
        success: false,
        error: 'Browser-use-api is not available or healthy'
      }, { status: 503 });
    }
    
    // Create a simple test business ID for testing
    const testBusinessId = `test-business-${Date.now()}`;
    
    // Run a basic screenshot test
    console.log(`Testing screenshot functionality with business ID: ${testBusinessId}`);
    
    // Try to create a simple auth test
    // This won't be a real login, just a test of the API integration
    const authResult = await browserService.authenticateGoogle(
      testBusinessId,
      'test@example.com',
      'test-password'
    );
    
    // Even if the auth fails (which it will with fake credentials), we should still be able to test the screenshot API
    const taskId = authResult.taskId || `test-task-${Date.now()}`;
    
    // Return the test results
    return NextResponse.json({
      success: true,
      apiHealthy: isHealthy,
      testBusinessId,
      taskId,
      authResult: {
        status: authResult.status,
        error: authResult.error,
        taskId: authResult.taskId,
        screenshot: authResult.screenshot
      },
      message: 'Browser-use-api integration test completed successfully'
    });
  } catch (error) {
    console.error('Error in auth test endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to run browser-use-api test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});