import { NextRequest, NextResponse } from 'next/server';
import { activateBrowserInstance } from '@/lib/compliance/auth-service';

/**
 * API route to activate a browser instance for a business
 * 
 * @route POST /api/compliance/activate-browser
 * @body { businessId: string, instanceId: string }
 * @returns { success: boolean, message?: string, error?: string }
 */
export async function POST(req: NextRequest) {
  try {
    console.log('Activate browser API route called');
    const data = await req.json();
    
    if (!data.businessId || !data.instanceId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters: businessId and instanceId' 
        },
        { status: 400 }
      );
    }
    
    console.log(`Activating browser instance ${data.instanceId} for business ${data.businessId}`);
    
    // Activate the browser instance
    const result = await activateBrowserInstance(
      data.businessId,
      data.instanceId
    );
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to activate browser instance' 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error activating browser instance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}