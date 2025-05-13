import { NextRequest, NextResponse } from 'next/server';
import { BrowserAutomationService } from '@/lib/browser-automation';
import { getServerSession } from 'next-auth';
import { withAuth } from '@/lib/auth/middleware';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
// Use a relative import instead for the [...nextauth] route
import { authOptions } from '../../auth/[...nextauth]/route';

// Base directory for screenshots
const SCREENSHOTS_BASE_DIR = '/home/ubuntu/Social-Genius/src/api/browser-use/screenshots';

/**
 * API endpoint to retrieve screenshots from a Google authentication task
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    // Get the task ID and business ID from the query parameters
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const businessId = url.searchParams.get('businessId');
    const userId = url.searchParams.get('userId');
    const listAll = url.searchParams.get('listAll') === 'true';

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

    // If listAll is true, return all screenshots for the user
    if (listAll && userId) {
      return await listAllScreenshotsForUser(userId);
    }
    
    // Regular screenshot retrieval for a specific task
    if (!taskId || !businessId) {
      return NextResponse.json(
        { 
          error: 'Missing required parameters (taskId or businessId)' 
        }, 
        { status: 400 }
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
        // If external screenshots fail, try looking in the local folder
        const filesFromDisk = await getScreenshotsFromDisk(businessId);
        
        if (filesFromDisk && Object.keys(filesFromDisk).length > 0) {
          return NextResponse.json({
            screenshots: filesFromDisk
          });
        }
        
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

/**
 * Helper function to list all screenshots stored on disk for a user
 */
async function listAllScreenshotsForUser(userId: string): Promise<NextResponse> {
  try {
    const userDir = path.join(SCREENSHOTS_BASE_DIR, userId);
    
    // Check if directory exists
    if (!fs.existsSync(userDir)) {
      return NextResponse.json(
        { 
          error: `No screenshots found for user ID ${userId}` 
        }, 
        { status: 404 }
      );
    }
    
    // Read all files in the directory
    const files = await fsPromises.readdir(userDir);
    
    // Filter for image files (only accept PNG, JPG, JPEG)
    const imageFiles = files.filter(file => 
      file.endsWith('.png') || 
      file.endsWith('.jpg') || 
      file.endsWith('.jpeg')
    );
    
    // Log warning if any non-image files are found
    const nonImageFiles = files.filter(file => 
      !file.endsWith('.png') && 
      !file.endsWith('.jpg') && 
      !file.endsWith('.jpeg') &&
      !file.startsWith('.')  // Skip hidden files
    );
    
    if (nonImageFiles.length > 0) {
      console.warn(`Found ${nonImageFiles.length} non-image files in screenshots directory for user ${userId}`);
    }
    
    // Group files by type/prefix
    const groupedFiles: Record<string, string[]> = {};
    
    for (const file of imageFiles) {
      // Group by prefix (e.g., pre-login, page-load, post-login)
      const prefix = file.split('-')[0] || 'other';
      
      if (!groupedFiles[prefix]) {
        groupedFiles[prefix] = [];
      }
      
      groupedFiles[prefix].push(file);
    }
    
    // Create file URLs for each screenshot
    const fileData = imageFiles.map(file => ({
      name: file,
      path: `/api/compliance/auth-screenshots/file/${userId}/${file}`,
      timestamp: getTimestampFromFilename(file),
      type: getFileType(file)
    }));
    
    // Sort files by timestamp (most recent first)
    fileData.sort((a, b) => b.timestamp - a.timestamp);
    
    return NextResponse.json({
      userId,
      screenshotCount: imageFiles.length,
      groups: groupedFiles,
      files: fileData
    });
  } catch (error) {
    console.error(`Error listing screenshots for user ${userId}:`, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to list user screenshots',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * Helper function to get screenshots from disk by businessId
 */
async function getScreenshotsFromDisk(businessId: string): Promise<Record<string, string> | null> {
  try {
    const businessDir = path.join(SCREENSHOTS_BASE_DIR, businessId);
    
    // Check if directory exists
    if (!fs.existsSync(businessDir)) {
      return null;
    }
    
    // Read all files in the directory
    const files = await fsPromises.readdir(businessDir);
    
    // Filter for image files and create data URLs
    const screenshots: Record<string, string> = {};
    
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        const filePath = path.join(businessDir, file);
        const data = await fsPromises.readFile(filePath);
        const base64 = data.toString('base64');
        const mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
        
        screenshots[file] = `data:${mimeType};base64,${base64}`;
      }
    }
    
    return screenshots;
  } catch (error) {
    console.error(`Error getting screenshots from disk for business ${businessId}:`, error);
    return null;
  }
}

/**
 * Helper function to extract timestamp from filename
 */
function getTimestampFromFilename(filename: string): number {
  // Typical format: pre-login-1680123456789.png or 1680123456789-something.png
  const matches = filename.match(/(\d{13})/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  return 0;
}

/**
 * Helper function to determine file type from filename
 */
function getFileType(filename: string): string {
  if (filename.startsWith('pre-login')) return 'pre-login';
  if (filename.startsWith('post-login')) return 'post-login';
  if (filename.startsWith('page-load')) return 'page-load';
  if (filename.startsWith('retry')) return 'retry';
  return 'other';
}

/**
 * API endpoint to retrieve a specific screenshot file
 */
export async function GET_FILE(req: NextRequest) {
  try {
    // Extract file path from the URL path segment
    // Expected format: /api/compliance/auth-screenshots/file/{userId}/{filename}
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    
    // Get user ID and filename from the path segments
    // Verify we have enough segments
    if (pathSegments.length < 6) {
      return NextResponse.json(
        { error: 'Invalid file path format' }, 
        { status: 400 }
      );
    }
    
    const userId = pathSegments[4];
    const filename = pathSegments[5];
    
    // Validate the filename to prevent path traversal
    if (filename.includes('..') || !filename.match(/^[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg)$/)) {
      return NextResponse.json(
        { error: 'Invalid filename' }, 
        { status: 400 }
      );
    }
    
    // Construct the full file path
    const filePath = path.join(SCREENSHOTS_BASE_DIR, userId, filename);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' }, 
        { status: 404 }
      );
    }
    
    // Read the file
    const fileBuffer = await fsPromises.readFile(filePath);
    
    // Determine content type
    let contentType = 'image/png';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    }
    
    // Return the file as a response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Error serving screenshot file:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to serve screenshot file',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
};