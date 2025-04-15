import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Skip detailed logging for favicon requests
    const isAssetRequest = request.nextUrl.pathname.includes('favicon.ico') || 
                          request.nextUrl.pathname.includes('_next');
    
    const url = request.nextUrl.toString();
    const timestamp = new Date().toISOString();
    
    // No logging for session API to reduce noise
    
    // Try to get cookie-based session info - check both cookies for compatibility
    const sessionCookie = request.cookies.get('session') || request.cookies.get('sessionId');
    
    if (sessionCookie && sessionCookie.value) {
      try {
        // Use our existing AuthService to validate the session
        const authService = AuthService.getInstance();
        const session = await authService.verifySession(sessionCookie.value);
        
        if (session && session.user) {
          // Create the response with the authenticated user
          const response = NextResponse.json({
            authenticated: true,
            user: {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name || "",
              profilePicture: session.user.profilePicture,
              phoneNumber: session.user.phoneNumber
            },
            timestamp: timestamp
          });
          
          // Ensure the cookies are kept
          const options = {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'lax' as const,
            maxAge: 30 * 24 * 60 * 60 // 30 days
          };
          
          // Re-add the session cookie to ensure it doesn't expire
          response.cookies.set(sessionCookie.name, sessionCookie.value, options);
          
          // Also set the other cookie format for compatibility
          const otherCookieName = sessionCookie.name === 'session' ? 'sessionId' : 'session';
          response.cookies.set(otherCookieName, sessionCookie.value, options);
          
          return response;
        }
      } catch (sessionError) {
        // Silent error handling for session endpoint
      }
    }
    
    // No valid session
    return NextResponse.json({
      authenticated: false,
      user: null,
      timestamp: timestamp
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[SESSION_API] ${timestamp} - Error in session endpoint:`, error);
    console.error(`[SESSION_API] ${timestamp} - Error stack:`, error instanceof Error ? error.stack : 'No stack');
    
    // Return a simple 200 response for favicon requests to avoid console errors
    if (request.nextUrl.pathname.includes('favicon.ico')) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        timestamp: timestamp
      });
    }
    
    return NextResponse.json({
      authenticated: false,
      error: 'Failed to get session',
      timestamp: timestamp
    }, { status: 500 });
  }
}