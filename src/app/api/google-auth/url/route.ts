/**
 * Google Auth URL Generation API Route
 * 
 * Generates an OAuth URL for Google Business Profile API authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google/oauth-service';
import { AuthService } from '@/services/auth';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '@/services/database';

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
      const db = DatabaseService.getInstance();
      const pool = db.getPool();
      
      // Check if the tokens table exists
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'google_oauth_tokens'
        );
      `);
      
      tablesExist = result.rows[0].exists;
      
      if (!tablesExist) {
        console.log('Google OAuth tables do not exist, initializing...');
        
        // Read the migration SQL file
        const migrationPath = path.join(process.cwd(), 'src', 'services', 'database', 'migrations', 'google_oauth_schema.sql');
        
        if (!fs.existsSync(migrationPath)) {
          console.error(`Migration file not found: ${migrationPath}`);
          return NextResponse.json({ 
            success: false, 
            error: 'Migration file not found' 
          }, { status: 500 });
        }
        
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        // Split the migration into individual statements
        const statements = migrationSql
          .split(';')
          .map(statement => statement.trim())
          .filter(statement => statement.length > 0);
        
        // Execute each statement with proper transaction management
        const client = await pool.connect();
        
        try {
          await client.query('BEGIN');
          
          for (const statement of statements) {
            await client.query(statement);
          }
          
          await client.query('COMMIT');
          
          console.log('Google OAuth tables initialized successfully');
        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error initializing Google OAuth tables:', error);
          return NextResponse.json({ 
            success: false, 
            error: 'Failed to initialize OAuth database tables' 
          }, { status: 500 });
        } finally {
          client.release();
        }
      }
    } catch (error) {
      console.error('Error checking or initializing Google OAuth tables:', error);
      // Continue anyway - we'll let the application try to proceed
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
    
    // Log all environment variables (without values) to help with debugging
    console.log('All environment variables:');
    Object.keys(process.env).forEach(key => {
      console.log(`- ${key}: ${key.includes('SECRET') || key.includes('KEY') ? '[MASKED]' : 'Present'}`);
    });
    
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