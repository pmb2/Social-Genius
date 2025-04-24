import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'crypto';
import { DatabaseService } from '@/services/database';
import { AuthService } from '@/services/auth';
import { initializeDatabase } from '@/services/database/init-db';

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
    const dbService = DatabaseService.getInstance();
    
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
    const { email, passwordHash, name } = body;
    
    if (!email || !passwordHash) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email and password hash are required' 
      }, { status: 400 });
    }
    
    // In development, we're allowing fallback to plain passwords when crypto API is unavailable
    // This check should be enabled in production only
    if (process.env.NODE_ENV === 'production' && passwordHash.length !== 64) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid password hash format' 
      }, { status: 400 });
    }
    
    // Use AuthService for registration (which handles database interactions properly)
    console.log('[REGISTER-API] Getting AuthService instance...');
    const authService = AuthService.getInstance();
    
    try {
      // Use the AuthService register method with the hashed password
      console.log('[REGISTER-API] Calling registerWithHash for email:', email);
      console.log('[REGISTER-API] Password hash length:', passwordHash?.length);
      console.log('[REGISTER-API] Password hash preview:', passwordHash?.substring(0, 10) + '...');
      console.log('[REGISTER-API] Has name:', !!name);
      
      const result = await authService.registerWithHash(email, passwordHash, name);
      console.log('[REGISTER-API] Registration result:', { 
        success: result.success, 
        userId: result.userId, 
        error: result.error 
      });
      
      if (!result.success) {
        console.log('[REGISTER-API] Registration failed:', result.error);
        return NextResponse.json({ 
          success: false, 
          error: result.error || 'Registration failed'
        }, { status: 400 });
      }
      
      console.log(`[REGISTER-API] User registered successfully with ID: ${result.userId}`);
      
      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Registration successful. Please log in.',
        userId: result.userId
      }, { status: 201 });
    } catch (registerError) {
      console.error('[REGISTER-API] Error during user registration:', registerError);
      console.error('[REGISTER-API] Error stack:', registerError instanceof Error ? registerError.stack : 'No stack available');
      
      // Extract more useful error message
      let errorMessage = 'Failed to create user account. Please try again.';
      if (registerError instanceof Error) {
        if (registerError.message.includes('duplicate') || 
            registerError.message.includes('already exists') || 
            registerError.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please use a different email or try to login.';
        } else if (registerError.message.includes('database') || 
                  registerError.message.includes('sql') || 
                  registerError.message.includes('connection')) {
          errorMessage = 'Database connection error occurred. Please try again later.';
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? 
          (registerError instanceof Error ? registerError.message : String(registerError)) : undefined
      }, { status: 500 });
    }
  } catch (error) {
    // Final catch for any unexpected errors
    console.error('[REGISTER-API] Unexpected registration error:', error);
    console.error('[REGISTER-API] Error stack:', error instanceof Error ? error.stack : 'No stack available');
    
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
      } else if (error.message.includes('duplicate') || 
                error.message.includes('already exists') || 
                error.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Please use a different email or try to login.';
        statusCode = 409; // Conflict
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