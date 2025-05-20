/**
 * Google Auth URL Generation API Route
 * 
 * Generates an OAuth URL for Google Business Profile API authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google/oauth-service';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';
import { initializeGoogleOAuth, verifyGoogleOAuthTables } from '@/services/database/init-google-oauth';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * Generates a Google OAuth URL for authentication
 */
export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/google-auth/url - Generating Google OAuth URL');
    
    // First, ensure Google OAuth tables exist
    let tablesExist = false;
    
    try {
      // Verify if tables exist
      tablesExist = await verifyGoogleOAuthTables();
      
      if (!tablesExist) {
        console.log('Google OAuth tables do not exist, initializing...');
        const initialized = await initializeGoogleOAuth();
        
        if (!initialized) {
          console.error('Failed to initialize Google OAuth tables');
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to initialize OAuth database tables' 
          }, { status: 500 });
        }
        
        console.log('Google OAuth tables initialized successfully');
      }
    } catch (error) {
      console.error('Error checking or initializing Google OAuth tables:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Database error: ' + (error.message || 'Failed to initialize OAuth tables') 
      }, { status: 500 });
    }
    
    // Verify user is authenticated
    const authService = AuthService.getInstance();
    
    // Get session cookie
    const cookieHeader = req.headers.get('cookie');
    console.log('Cookie header:', cookieHeader ? 'Present' : 'Missing');
    
    const cookies = authService.parseCookies(cookieHeader || '');
    const sessionId = cookies.session || cookies.sessionId;
    
    console.log('Session ID from cookies:', sessionId ? `${sessionId.substring(0, 6)}...` : 'Not found');
    
    if (!sessionId) {
      console.error('No session cookie found');
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Verify that the session is valid
    const session = await authService.verifySession(sessionId);
    if (!session) {
      console.error('Invalid or expired session');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session' 
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    console.log('Authenticated user ID:', userId);
    
    // Get business name from request body
    const body = await req.json();
    const { businessName, businessType = 'local' } = body;
    
    console.log('Request body:', { businessName, businessType });
    
    if (!businessName) {
      console.error('Business name is required');
      return NextResponse.json(
        { success: false, error: 'Business name is required' },
        { status: 400 }
      );
    }
    
    // Make sure OAuth environment variables are set
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    
    console.log('OAuth environment variables status:');
    console.log('- GOOGLE_CLIENT_ID:', clientId ? `Present (${clientId.substring(0, 5)}...)` : 'Missing');
    console.log('- GOOGLE_CLIENT_SECRET:', clientSecret ? 'Present' : 'Missing');
    console.log('- GOOGLE_REDIRECT_URI:', redirectUri || 'Missing');
    console.log('- GOOGLE_TOKEN_ENCRYPTION_KEY:', encryptionKey ? 'Present' : 'Missing');
    
    if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
      console.error('Missing required OAuth environment variables');
      
      return NextResponse.json({
        success: false,
        error: 'Google OAuth credentials are not properly configured. Please contact your administrator.',
        details: 'Missing required environment variables for Google OAuth',
        missingVars: {
          clientId: !clientId,
          clientSecret: !clientSecret,
          redirectUri: !redirectUri,
          encryptionKey: !encryptionKey
        }
      }, { status: 500 });
    }
    
    // Generate OAuth URL
    console.log('Creating GoogleOAuthService instance...');
    const oauthService = new GoogleOAuthService();
    
    console.log('Generating Auth URL...');
    
    // Store additional business information in the state
    const stateData = {
      userId: userId.toString(),
      businessName,
      businessType,
      timestamp: Date.now()
    };
    
    try {
      // Generate the URL with enhanced state data
      const url = oauthService.generateAuthUrl(stateData);
      console.log('Successfully generated OAuth URL');
      return NextResponse.json({ success: true, url });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate authentication URL' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate authentication URL' 
      },
      { status: 500 }
    );
  }
}