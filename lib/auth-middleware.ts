import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';

// Middleware to authenticate requests
export async function authMiddleware(
  req: NextRequest,
  handler: (req: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  const authService = AuthService.getInstance();
  
  // Get the session ID from cookies - check both "session" and "sessionId" for compatibility
  const sessionId = req.cookies.get('session')?.value || req.cookies.get('sessionId')?.value;
  
  if (!sessionId) {
    // Return proper JSON response
    return NextResponse.json({
      success: false,
      error: 'Authentication required'
    }, { status: 401 });
  }
  
  // Verify session
  const session = await authService.verifySession(sessionId);
  if (!session) {
    // Return proper JSON response for invalid session
    return NextResponse.json({
      success: false,
      error: 'Invalid or expired session'
    }, { status: 401 });
  }
  
  try {
    // Call the handler with the authenticated user ID
    return handler(req, session.user_id);
  } catch (error) {
    console.error('Error in authenticated handler:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper function to create an authenticated API route
export function createAuthRoute(
  handler: (req: NextRequest, userId: number) => Promise<NextResponse>
) {
  return async function(req: NextRequest) {
    try {
      return await authMiddleware(req, handler);
    } catch (error) {
      console.error('Error in auth route:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };
}