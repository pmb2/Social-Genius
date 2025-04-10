import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Explicit rejection of GET method to prevent password exposure in URL
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed. Please use POST for authentication.' 
  }, { status: 405 });
}

// Proper login endpoint
export async function POST(req: NextRequest) {
  // Wrap everything in a try/catch to catch any unexpected errors
  try {
    // Security check - don't log content-type details in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('Login API called with content-type:', req.headers.get('content-type'));
    }
    
    // Force disable native pg and enable debug
    process.env.NODE_PG_FORCE_NATIVE = '0';
    process.env.DEBUG_DATABASE = 'true';
    process.env.PG_DEBUG = 'true';
    
    // Load pg patch first to ensure it's applied
    try {
      require('@/pg-patch.cjs');
      console.log('✅ pg-patch applied in login route');
    } catch (patchError) {
      console.error('Failed to apply pg-patch in login route:', patchError);
    }
    
    // Get services
    const authService = AuthService.getInstance();
    const dbService = PostgresService.getInstance();
    
    // Print environment variables for debugging
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('DATABASE_URL_DOCKER:', process.env.DATABASE_URL_DOCKER ? 'SET' : 'NOT SET');
    console.log('RUNNING_IN_DOCKER:', process.env.RUNNING_IN_DOCKER);
    
    // Ensure database connection is available
    try {
      await dbService.testConnection();
      console.log('Database connection successful');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: 'Database connection failed. Please try again later.',
        details: String(dbError)
      }, { status: 500 });
    }
    
    // Parse request body (with fallback for parsing errors)
    let body;
    try {
      const bodyText = await req.text();
      body = JSON.parse(bodyText);
      // Security: Only log presence of fields, never the values
      console.log('Request body parsed:', { email: body.email ? 'Present' : 'Missing', password: body.password ? 'Present' : 'Missing' });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request format. Please provide a valid JSON body.' 
      }, { status: 400 });
    }
    
    // Extract and validate input
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email and password are required' 
      }, { status: 400 });
    }
    
    // Attempt to login the user
    try {
      const loginResult = await authService.login(email, password);
      
      if (!loginResult.success) {
        return NextResponse.json({ 
          success: false, 
          error: loginResult.error || 'Authentication failed' 
        }, { status: 401 });
      }
      
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
      
      // Set both cookie names for compatibility - with more relaxed settings for development
      response.cookies.set({
        name: 'session',
        value: sessionId,
        httpOnly: true,
        path: '/',
        sameSite: 'none', // Allow cross-site usage
        secure: true, // Always use secure in modern browsers
        maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
      });
      
      // Also set sessionId cookie for compatibility
      response.cookies.set({
        name: 'sessionId',
        value: sessionId,
        httpOnly: true,
        path: '/',
        sameSite: 'none', // Allow cross-site usage
        secure: true, // Always use secure in modern browsers
        maxAge: 30 * 24 * 60 * 60 // 30 days in seconds
      });
      
      console.log(`Login successful for user ${email}, session created: ${sessionId}`);
      return response;
    } catch (loginError) {
      console.error('Error during login process:', loginError);
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication service error' 
      }, { status: 500 });
    }
  } catch (error) {
    // Final catch for any unexpected errors
    console.error('Unexpected login error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}