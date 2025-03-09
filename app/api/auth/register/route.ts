import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'crypto';
import PostgresService from '@/services/postgres-service';
import AuthService from '@/services/auth-service';
import { initializeDatabase } from '@/lib/init-db';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Disable middleware for this route by adding a marker
export const preferredRegion = 'auto';

// Proper registration endpoint
export async function POST(req: NextRequest) {
  console.log('*** REGISTER API CALLED ***');
  console.log('Request headers:', JSON.stringify(Array.from(req.headers.entries())));
  
  // Wrap everything in a try/catch to catch any unexpected errors
  try {
    console.log('Register API called with content-type:', req.headers.get('content-type'));
    
    // Initialize database first to ensure tables exist
    console.log('Ensuring database is initialized...');
    const dbInitialized = await initializeDatabase();
    
    if (!dbInitialized) {
      console.error('Database initialization failed');
      return NextResponse.json({ 
        success: false, 
        error: 'Database initialization failed. Please check database configuration.' 
      }, { status: 500 });
    }
    
    // Get database service
    const dbService = PostgresService.getInstance();
    
    // Ensure database connection is available
    try {
      const isConnected = await dbService.testConnection();
      if (!isConnected) {
        throw new Error('Database connection failed after multiple attempts');
      }
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
    const { email, password, name } = body;
    
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email and password are required' 
      }, { status: 400 });
    }
    
    if (password.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 });
    }
    
    // Use AuthService for registration (which handles database interactions properly)
    const authService = AuthService.getInstance();
    
    try {
      // Use the AuthService register method
      const result = await authService.register(email, password, name);
      
      if (!result.success) {
        return NextResponse.json({ 
          success: false, 
          error: result.error || 'Registration failed'
        }, { status: 400 });
      }
      
      console.log(`User registered with ID: ${result.userId}`);
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Registration successful. Please log in.',
        userId: result.userId
      }, { status: 201 });
    } catch (registerError) {
      console.error('Error during user registration:', registerError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create user account. Please try again.' 
      }, { status: 500 });
    }
  } catch (error) {
    // Final catch for any unexpected errors
    console.error('Unexpected registration error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
    // Return a very simple response
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}