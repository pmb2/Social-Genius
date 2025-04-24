import { NextRequest, NextResponse } from 'next/server';
import { BrowserAutomationService } from '@/lib/browser-automation';
import { getServerSession } from 'next-auth';
import { withAuth } from '@/lib/auth/middleware';
// Use a relative import instead for the [...nextauth] route
import { authOptions } from '../../auth/[...nextauth]/route';

/**
 * API endpoint to retrieve screenshots from a Google authentication task
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    // Get the task ID and business ID from the query parameters
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const businessId = url.searchParams.get('businessId');

    // Validate required parameters
    if (!taskId || !businessId) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters (taskId or businessId)' 
        }, 
        { status: 400 }
      );
    }

    // Validate session to ensure the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized access: valid session required' 
        }, 
        { status: 401 }
      );
    }

    console.log(`Retrieving screenshots for task ${taskId}, business ${businessId}`);

    // Get the browser automation service
    const browserService = BrowserAutomationService.getInstance();
    
    // First try to get all screenshots
    const screenshots = await browserService.getAllScreenshots(taskId, businessId);
    
    // If that fails, try to get at least the final screenshot
    if (!screenshots) {
      const finalScreenshot = await browserService.getScreenshot(taskId, businessId);
      
      if (finalScreenshot) {
        return NextResponse.json({
          screenshots: { 'final_state': finalScreenshot }
        });
      } else {
        return NextResponse.json(
          { 
            error: 'No screenshots found for this task' 
          }, 
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json({
      screenshots
    });
  } catch (error) {
    console.error('Error retrieving authentication screenshots:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve authentication screenshots',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
});