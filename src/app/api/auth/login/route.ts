import { NextRequest, NextResponse } from 'next/server';
import '@/lib/utilities/pg-patch'; // Import pg patch to ensure pg-native is correctly handled
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Proper login endpoint
export async function POST(req: NextRequest) {
  // Wrap everything in a try/catch to catch any unexpected errors
  try {
    console.log('==========================================');
    console.log('LOGIN API CALLED - DEBUGGING CONNECTION ISSUES');
    console.log('Content-type:', req.headers.get('content-type'));
    console.log('Environment:', process.env.NODE_ENV);
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    
    // Check if running in Docker
    const runningInDocker = process.env.RUNNING_IN_DOCKER === 'true';
    console.log('Running in Docker:', runningInDocker);
    
    // Explicitly set connection string based on environment
    if (runningInDocker) {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
      console.log('Using Docker database connection: postgres:5432');
    } else {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5435/socialgenius';
      console.log('Using host machine connection: localhost:5435');
    }
    
    // Make sure pg-native is disabled
    process.env.NODE_PG_FORCE_NATIVE = '0';
    console.log('NODE_PG_FORCE_NATIVE set to:', process.env.NODE_PG_FORCE_NATIVE);
    
    // Get services
    const authService = AuthService.getInstance();
    const dbService = DatabaseService.getInstance();
    console.log('Auth service and DB service instances created successfully');
    
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
      
      // Success - create a response with the login data
      const response = NextResponse.json({
        success: true,
        user: {
          id: loginResult.user.id,
          email: loginResult.user.email,
          name: loginResult.user.name
        }
      }, { status: 200 });
      
      // Set the session cookie
      const sessionId = loginResult.user.sessionId;
      
      // Debug the environment
      console.log('Setting cookies with environment:', {
        nodeEnv: process.env.NODE_ENV,
        isDev: process.env.NODE_ENV !== 'production',
        protocol: req.headers.get('x-forwarded-proto') || 'http', 
        host: req.headers.get('host'),
      });
      
      // Set both cookie names for compatibility - with relaxed settings for development
      console.log('[LOGIN-API] Setting cookies with session ID:', sessionId?.substring(0, 8) + '...');
      console.log('[LOGIN-API] Cookie environment settings:', {
        nodeEnv: process.env.NODE_ENV,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
      });
      
      try {
        // Add cookies to the response
        const setSessionCookies = (response: NextResponse, sessionId: string) => {
          // Determine environment for cookie settings
          const nodeEnv = process.env.NODE_ENV || 'development';
          const isDev = nodeEnv === 'development';
          const protocol = isDev ? 'http' : 'https';
          const host = process.env.HOST || req.headers.get('host') || 'localhost:3000';
          
          const timestamp = new Date().toISOString();
          console.log(`[LOGIN-API] ${timestamp} - Setting cookies with environment:`, {
            nodeEnv,
            isDev,
            protocol,
            host
          });
          
          // Explicitly use relaxed settings for development to ensure cookies are set
          const cookieOptions = {
            name: 'session',
            value: sessionId,
            httpOnly: true,
            path: '/',
            sameSite: 'lax' as const,
            secure: false, // For development, always set to false
            maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
          };
          
          console.log(`[LOGIN-API] ${timestamp} - Using relaxed cookie options for development:`, cookieOptions);
          
          // Set both formats for compatibility
          response.cookies.set('session', sessionId, cookieOptions);
          response.cookies.set('sessionId', sessionId, cookieOptions);
          
          // Log the cookies that were set in the response
          console.log(`[LOGIN-API] ${timestamp} - Cookies set in response:`, 
                     response.cookies.getAll().map(c => `${c.name}=${c.value.substring(0, 8)}...`));
          
          return response;
        };
        
        // Apply the cookies
        setSessionCookies(response, sessionId);
        console.log('[LOGIN-API] Cookies set successfully with improved method');
      } catch (cookieError) {
        console.error('[LOGIN-API] Error setting cookies:', cookieError);
        // Continue anyway since the login was successful
      }
      
      console.log(`[LOGIN-API] Login successful for user ${email}, session created: ${sessionId?.substring(0, 8)}...`);
      console.log(`[LOGIN-API] All cookies in response:`, Array.from(response.cookies.getAll().map(c => c.name)));
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