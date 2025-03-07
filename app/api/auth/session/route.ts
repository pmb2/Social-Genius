import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Skip detailed logging for favicon requests
    const isAssetRequest = request.nextUrl.pathname.includes('favicon.ico') || 
                          request.nextUrl.pathname.includes('_next');
    
    if (!isAssetRequest) {
      console.log("Session API called for:", request.nextUrl.pathname);
    }
    
    // Try to get cookie-based session info
    const sessionCookie = request.cookies.get('session');
    
    if (!isAssetRequest) {
      console.log("Session cookie present:", !!sessionCookie);
    }
    
    if (sessionCookie && sessionCookie.value) {
      try {
        // Use our existing AuthService to validate the session
        const authService = AuthService.getInstance();
        const session = await authService.verifySession(sessionCookie.value);
        
        if (session && session.user) {
          if (!isAssetRequest) {
            console.log("Valid session found for user:", session.user.email);
          }
          
          return NextResponse.json({
            authenticated: true,
            user: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name || ""
            }
          });
        }
      } catch (sessionError) {
        // Just log the error and continue to return mock user
        console.error("Error verifying session:", sessionError);
      }
    }
    // No valid session
    if (!isAssetRequest) {
      console.log("No valid session found");
    }
    
    return NextResponse.json({
      authenticated: false,
      user: null
    });
  } catch (error) {
    console.error('Error in session endpoint:', error);
    
    // Return a simple 200 response for favicon requests to avoid console errors
    if (request.nextUrl.pathname.includes('favicon.ico')) {
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }
    
    return NextResponse.json({
      authenticated: false,
      error: 'Failed to get session'
    }, { status: 500 });
  }
}