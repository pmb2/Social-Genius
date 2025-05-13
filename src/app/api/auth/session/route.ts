import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Skip detailed logging for favicon requests
    const isAssetRequest = request.nextUrl.pathname.includes('favicon.ico') || 
                          request.nextUrl.pathname.includes('_next');
    
    const url = request.nextUrl.toString();
    const timestamp = new Date().toISOString();
    
    // Check if this is a silent session check (used when modals are open)
    const isSilentCheck = request.headers.get('X-Session-Check') === 'silent';
    const isQuietCheck = request.headers.get('X-Session-Check') === 'quiet';
    
    // Try to get cookie-based session info - check both cookies for compatibility
    const sessionCookie = request.cookies.get('session') || request.cookies.get('sessionId');
    const allCookieKeys = Array.from(request.cookies.getAll()).map(c => c.name).join(', ');
    
    console.log(`[SESSION_API] ${timestamp} - Session request from ${request.nextUrl.toString()}`);
    console.log(`[SESSION_API] ${timestamp} - Request headers:`);
    console.log(`[SESSION_API] ${timestamp} - User-Agent: ${request.headers.get('user-agent') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Accept: ${request.headers.get('accept') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - X-Session-Check: ${request.headers.get('X-Session-Check') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Content-Type: ${request.headers.get('content-type') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Origin: ${request.headers.get('origin') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Referer: ${request.headers.get('referer') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Cookie presence: ${allCookieKeys || 'no cookies'}`);
    console.log(`[SESSION_API] ${timestamp} - Session cookie: ${sessionCookie ? `found (${sessionCookie.name})` : 'not found'}`);
    
    if (sessionCookie && sessionCookie.value) {
      console.log(`[SESSION_API] ${timestamp} - Session cookie value: ${sessionCookie.value.substring(0, 8)}...`);
      console.log(`[SESSION_API] ${timestamp} - Session cookie options:`, JSON.stringify({
        domain: sessionCookie.domain,
        expires: sessionCookie.expires,
        httpOnly: sessionCookie.httpOnly,
        maxAge: sessionCookie.maxAge,
        path: sessionCookie.path,
        sameSite: sessionCookie.sameSite,
        secure: sessionCookie.secure
      }));
      
      try {
        // Use our existing AuthService to validate the session
        const authService = AuthService.getInstance();
        console.log(`[SESSION_API] ${timestamp} - Verifying session with AuthService...`);
        // The verifySession method will also update the last_login timestamp
        const session = await authService.verifySession(sessionCookie.value);
        
        if (session && session.user) {
          // Create the response with the authenticated user
          let responseData = {
            authenticated: true,
            timestamp: timestamp
          };
          
          // Only include user data for non-silent checks
          if (!isSilentCheck) {
            responseData = {
              ...responseData,
              user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name || "",
                profilePicture: session.user.profilePicture,
                phoneNumber: session.user.phoneNumber
              }
            };
          }
          
          const response = NextResponse.json(responseData);
          
          // Add cache control headers to prevent automatic refreshes
          response.headers.set('Cache-Control', 'private, max-age=60');
          response.headers.set('X-Session-Updated', new Date().toISOString());
          
          // Maximize the session cookie lifetime on each verification
          // This effectively creates a sliding session that stays active as long as the user is active
          
          console.log(`[SESSION_API] ${timestamp} - Refreshing session cookies...`);
          
          // Use authService's cookie options function and pass the request headers
          // This ensures cookie settings are consistent throughout the app
          const cookieSettings = authService.getSessionCookieOptions(30 * 24 * 60 * 60 * 1000, request.headers);
          
          const options = {
            secure: cookieSettings.options.secure,
            httpOnly: cookieSettings.options.httpOnly,
            sameSite: cookieSettings.options.sameSite,
            // Use a very long expiration to prevent expiry during active usage
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in seconds
          };
          
          // Re-add the session cookie to ensure it doesn't expire
          response.cookies.set(sessionCookie.name, sessionCookie.value, options);
          console.log(`[SESSION_API] ${timestamp} - Set cookie: ${sessionCookie.name} (value: ${sessionCookie.value.substring(0, 8)}...)`);
          
          // Also set the other cookie format for compatibility
          const otherCookieName = sessionCookie.name === 'session' ? 'sessionId' : 'session';
          response.cookies.set(otherCookieName, sessionCookie.value, options);
          console.log(`[SESSION_API] ${timestamp} - Set compatibility cookie: ${otherCookieName}`);
          
          // Log the full cookie details for debugging
          console.log(`[SESSION_API] ${timestamp} - Cookie options used:`, JSON.stringify(options));
          console.log(`[SESSION_API] ${timestamp} - Response cookie headers set: ${response.headers.has('set-cookie') ? 'yes' : 'no'}`);
          if (response.headers.has('set-cookie')) {
            console.log(`[SESSION_API] ${timestamp} - Set-Cookie header: ${response.headers.get('set-cookie')?.substring(0, 100)}...`);
          }
          
          // Log the cookie renewal (only in development and not for silent checks)
          if (process.env.NODE_ENV === 'development' && !isSilentCheck && !isQuietCheck) {
            console.log(`Session cookie renewed, expires in 30 days`);
          }
          
          return response;
        }
      } catch (sessionError) {
        // Silent error handling for session endpoint
      }
    }
    
    // For silent checks, always return success to avoid disrupting the UI
    if (isSilentCheck) {
      return NextResponse.json({
        acknowledged: true,
        timestamp: timestamp
      });
    }
    
    // No valid session
    return NextResponse.json({
      authenticated: false,
      user: null,
      timestamp: timestamp
    });
  } catch (error) {
    // Create a new timestamp for the error handling section
    const errorTimestamp = new Date().toISOString();
    
    // Check if this is a silent session check (used when modals are open)
    const isSilentCheck = request.headers.get('X-Session-Check') === 'silent';
    
    // For silent checks, never log errors or disrupt the UI
    if (isSilentCheck) {
      return NextResponse.json({
        acknowledged: true,
        timestamp: errorTimestamp
      });
    }
    
    console.error(`[SESSION_API] ${errorTimestamp} - Error in session endpoint:`, error);
    console.error(`[SESSION_API] ${errorTimestamp} - Error stack:`, error instanceof Error ? error.stack : 'No stack');
    
    // Return a simple 200 response for favicon requests to avoid console errors
    if (request.nextUrl.pathname.includes('favicon.ico')) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        timestamp: errorTimestamp
      });
    }
    
    return NextResponse.json({
      authenticated: false,
      error: 'Failed to get session',
      timestamp: errorTimestamp
    }, { status: 500 });
  }
}