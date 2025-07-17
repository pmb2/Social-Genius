import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth/auth-service';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';

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
    
    // Get session from iron-session
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    const allCookieKeys = Array.from(request.cookies.getAll()).map(c => c.name).join(', ');
    console.log(`[SESSION_API] ${timestamp} - Raw incoming cookie header: ${request.headers.get('cookie')}`);
    
    console.log(`[SESSION_API] ${timestamp} - Session request from ${request.nextUrl.toString()}`);
    console.log(`[SESSION_API] ${timestamp} - Request headers:`);
    console.log(`[SESSION_API] ${timestamp} - User-Agent: ${request.headers.get('user-agent') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Accept: ${request.headers.get('accept') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - X-Session-Check: ${request.headers.get('X-Session-Check') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Content-Type: ${request.headers.get('content-type') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Origin: ${request.headers.get('origin') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Referer: ${request.headers.get('referer') || 'none'}`);
    console.log(`[SESSION_API] ${timestamp} - Cookie presence: ${allCookieKeys || 'no cookies'}`);
    console.log(`[SESSION_API] ${timestamp} - Session cookie: ${session.isLoggedIn ? `found (social_genius_session)` : 'not found'}`);
    
    if (session.isLoggedIn && session.id) {
      console.log(`[SESSION_API] ${timestamp} - Session ID from iron-session: ${session.id}`);
      
      try {
        const authService = AuthService.getInstance();
        // Directly get user from DB using the session ID from iron-session
        console.log(`[SESSION_API] ${timestamp} - Verifying session for session.id: ${session.id}`);
        const user = await authService.verifySession(session.id);
        console.log(`[SESSION_API] ${timestamp} - User object after verifySession: ${JSON.stringify(user)}`);
        console.log(`[SESSION_API] ${timestamp} - User returned from verifySession: ${user ? user.id : 'null'}`);
        
        if (user) {
          console.log(`[SESSION_API] ${timestamp} - User data from verifySession: ${JSON.stringify(user)}`);
          // Update last login timestamp
          await authService.getDatabase().updateLastLogin(user.id);

          let responseData: { authenticated: boolean; timestamp: string; user?: { id: number; email: string; name: string | null | undefined; profilePicture: string | undefined; phoneNumber: string | undefined; }; } = {
            authenticated: true,
            timestamp: timestamp,
            user: undefined
          };
          
          if (!isSilentCheck) {
            responseData = {
              ...responseData,
              user: {
                user: {
                id: user.id,
                email: user.email,
                name: user.name || "",
                profilePicture: user.profile_picture,
                phoneNumber: user.phone_number,
                planId: user.planId || "basic"
            }
              }
            };
          }
          
          const response = NextResponse.json(responseData);
          
          response.headers.set('Cache-Control', 'private, max-age=60');
          response.headers.set('X-Session-Updated', new Date().toISOString());
          
          // Save the session to update its expiration (sliding session)
          await session.save();
          console.log(`[SESSION_API] ${timestamp} - Session saved (expiration updated)`);
          
          if (process.env.NODE_ENV === 'development' && !isSilentCheck && !isQuietCheck) {
            console.log(`Session cookie renewed, expires in 30 days`);
          }
          
          return response;
        }
      } catch (sessionError) {
        console.error(`[SESSION_API] ${timestamp} - Error verifying session or fetching user:`, sessionError);
        // Invalidate session if there's an error fetching user
        session.destroy();
      }
    }
    
    if (isSilentCheck) {
      return NextResponse.json({
        acknowledged: true,
        timestamp: timestamp
      });
    }
    
    return NextResponse.json({
      authenticated: false,
      user: null,
      timestamp: timestamp
    });
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    const isSilentCheck = request.headers.get('X-Session-Check') === 'silent';
    
    if (isSilentCheck) {
      return NextResponse.json({
        acknowledged: true,
        timestamp: errorTimestamp
      });
    }
    
    console.error(`[SESSION_API] ${errorTimestamp} - Error in session endpoint:`, error);
    console.error(`[SESSION_API] ${errorTimestamp} - Error stack:`, error instanceof Error ? error.stack : 'No stack');
    
    if (request.nextUrl.pathname.includes('favicon.ico')) {
      return new NextResponse(null, { status: 204 });
    }
    
    return NextResponse.json({
      authenticated: false,
      error: 'Failed to get session',
      timestamp: errorTimestamp
    }, { status: 500 });
  }
}