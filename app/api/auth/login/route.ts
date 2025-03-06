import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import AuthService from '@/services/auth-service';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Proper login endpoint
export async function POST(req: NextRequest) {
  // Wrap everything in a try/catch to catch any unexpected errors
  try {
    console.log('Login API called with content-type:', req.headers.get('content-type'));
    
    // Get services
    const authService = AuthService.getInstance();
    const dbService = PostgresService.getInstance();
    
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
      response.cookies.set({
        name: 'sessionId',
        value: sessionId,
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
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