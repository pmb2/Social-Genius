import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Proper login endpoint
export async function POST(req: NextRequest) {
  // Wrap everything in a try/catch to catch any unexpected errors
  try {
    console.log('Login API called with content-type:', req.headers.get('content-type'));
    
    // Get services
    const authService = AuthService.getInstance();
    const dbService = DatabaseService.getInstance();
    
    // Ensure database connection is available
    try {
      await dbService.testConnection();
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database connection failed. Please try again later.' 
      }, { status: 500 });
    }
    
    // Parse request body (with fallback for parsing errors)
    let body;
    try {
      const bodyText = await req.text();
      body = JSON.parse(bodyText);
      console.log('Request body parsed:', { email: body.email ? 'Present' : 'Missing' });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request format. Please provide a valid JSON body.' 
      }, { status: 400 });
    }
    
    // Extract and validate input
    const { email, passwordHash } = body;
    
    if (!email || !passwordHash) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email and password hash are required' 
      }, { status: 400 });
    }
    
    // Attempt to login the user with the password hash instead of plaintext password
    try {
      console.log('[LOGIN-API] Calling authService.loginWithHash with email:', email);
      console.log('[LOGIN-API] Password hash length:', passwordHash?.length);
      console.log('[LOGIN-API] Password hash preview:', passwordHash?.substring(0, 10) + '...');
      
      const loginResult = await authService.loginWithHash(email, passwordHash);
      console.log('[LOGIN-API] Login result:', { 
        success: loginResult.success, 
        hasUser: !!loginResult.user,
        hasToken: !!loginResult.token,
        error: loginResult.error 
      });
      
      if (!loginResult.success) {
        console.log('[LOGIN-API] Login failed:', loginResult.error);
        return NextResponse.json({ 
          success: false, 
          error: loginResult.error || 'Authentication failed' 
        }, { status: 401 });
      }
      
      console.log('[LOGIN-API] Login successful for user:', loginResult.user?.email);
      
      // Get the iron-session instance
      const session = await getIronSession(cookies(), sessionOptions);

      // Set session data
      session.id = loginResult.user.id;
      session.isLoggedIn = true;
      await session.save();

      console.log(`[LOGIN-API] Session set for user ${email}, session ID: ${session.id}, loginResult.user.id: ${loginResult.user.id}`);
      
      // Success - create a response with the login data
      const response = NextResponse.json({
        success: true,
        user: {
          id: loginResult.user.id,
          email: loginResult.user.email,
          name: loginResult.user.name,
        },
      }, { status: 200 });
      
      console.log(`[LOGIN-API] Response Set-Cookie header: ${response.headers.get('Set-Cookie')}`);
      console.log(`[LOGIN-API] Login successful for user ${email}, session created: ${session.id}`);
      return response;
    } catch (loginError) {
      console.error('[LOGIN-API] Error during login process:', loginError);
      console.error('[LOGIN-API] Error stack:', loginError instanceof Error ? loginError.stack : 'No stack available');
      
      // Extract more useful error message
      let errorMessage = 'Authentication service error';
      if (loginError instanceof Error) {
        // Try to extract a more specific error message
        if (loginError.message.includes('database') || loginError.message.includes('sql') || 
            loginError.message.includes('connection')) {
          errorMessage = 'Database connection error occurred. Please try again.';
        } else if (loginError.message.includes('credential') || loginError.message.includes('password') || 
                   loginError.message.includes('auth')) {
          errorMessage = 'Authentication failed. Please check your credentials.';
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? 
          (loginError instanceof Error ? loginError.message : String(loginError)) : undefined
      }, { status: 500 });
    }
  } catch (error) {
    // Final catch for any unexpected errors
    console.error('[LOGIN-API] Unexpected login error:', error);
    console.error('[LOGIN-API] Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
    // Attempt to categorize the error for better client feedback
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('database') || 
          error.message.includes('sql') || 
          error.message.includes('connection')) {
        errorMessage = 'Database connection error. Please try again later.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'The server took too long to respond. Please try again.';
      } else if (error.message.includes('parse') || error.message.includes('json')) {
        errorMessage = 'Invalid request format. Please check your input.';
        statusCode = 400;
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined
    }, { status: statusCode });
  }
}
