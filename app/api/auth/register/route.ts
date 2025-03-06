import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'crypto';
import PostgresService from '@/services/postgres-service';

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
    
    // Get database service
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
    
    // Check if user already exists
    try {
      const existingUser = await dbService.getUserByEmail(email);
      if (existingUser) {
        return NextResponse.json({ 
          success: false, 
          error: 'Email already registered' 
        }, { status: 400 });
      }
    } catch (userCheckError) {
      console.error('Error checking if user exists:', userCheckError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error checking user records' 
      }, { status: 500 });
    }
    
    // Create password hash
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    const passwordHash = `${salt}:${hash}`;
    
    // Register user in database
    try {
      const userId = await dbService.registerUser(email, passwordHash, name);
      console.log(`User registered with ID: ${userId}`);
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Registration successful. Please log in.',
        userId
      }, { status: 201 });
    } catch (registerError) {
      console.error('Error registering user:', registerError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create user account' 
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