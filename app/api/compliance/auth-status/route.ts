import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to check browser-use-api authentication status
 * 
 * @route POST /api/compliance/auth-status
 * @body { token: string }
 * @returns { valid: boolean, businessId?: string, permissions?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    console.log('Auth status API route called');
    const data = await req.json();
    
    // Validate required fields
    if (!data.token) {
      return NextResponse.json(
        { valid: false },
        { status: 400 }
      );
    }
    
    // Import dynamically to prevent server-side bundling issues
    const { verifyComplianceToken } = await import('@/lib/compliance/auth-service');
    
    // Verify the token
    const result = await verifyComplianceToken(data.token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { valid: false },
      { status: 500 }
    );
  }
}